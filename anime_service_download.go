package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *AnimeService) GetDownloads() (map[string][]string, error) {
	downloads := make(map[string][]string)
	entries, err := os.ReadDir(a.downloadsDir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			animeName := entry.Name()
			epEntries, err := os.ReadDir(filepath.Join(a.downloadsDir, animeName))
			if err != nil {
				continue
			}
			var eps []string
			for _, epEntry := range epEntries {
				if epEntry.IsDir() {
					eps = append(eps, epEntry.Name())
				}
			}
			if len(eps) > 0 {
				downloads[animeName] = eps
			}
		}
	}
	return downloads, nil
}

func (a *AnimeService) CheckDownloadStatus(animeName, epNumStr string) bool {
	epDir := a.getEpisodeDir(animeName, epNumStr)
	if _, err := os.Stat(filepath.Join(epDir, "episode.mp4")); err == nil {
		return true
	}
	_, err := os.Stat(filepath.Join(epDir, "stream_metadata.json"))
	return err == nil
}

func (a *AnimeService) DeleteDownload(animeName, epNumStr string) error {
	epDir := a.getEpisodeDir(animeName, epNumStr)
	return os.RemoveAll(epDir)
}

func (a *AnimeService) GetActiveDownloads() map[string]int {
	active := make(map[string]int)
	a.progressMap.Range(func(key, value interface{}) bool {
		active[key.(string)] = value.(int)
		return true
	})
	return active
}

func (a *AnimeService) DownloadEpisode(animeName, animeURL, animeSource, epNumStr, epURL string, epNum float64, isDub bool) error {
	key := animeName + ":" + epNumStr
	fmt.Printf("Starting download: %s\n", key)

	runtime.EventsEmit(a.ctx, "download-progress", map[string]interface{}{
		"key":       key,
		"animeName": animeName,
		"episode":   epNumStr,
		"progress":  0,
	})

	a.cancelMutex.Lock()
	if _, exists := a.cancelFuncs[key]; exists {
		a.cancelMutex.Unlock()
		return fmt.Errorf("download already in progress for %s", key)
	}
	ctx, cancel := context.WithCancel(a.ctx)
	a.cancelFuncs[key] = cancel
	a.cancelMutex.Unlock()

	defer func() {
		a.cancelMutex.Lock()
		delete(a.cancelFuncs, key)
		a.cancelMutex.Unlock()
		a.progressMap.Delete(key)
	}()

	rawURL, headers, err := a.ResolveStreamURL(animeName, animeURL, animeSource, epNumStr, epURL, epNum, isDub)
	if err != nil {
		fmt.Printf("[%s] Error resolving raw stream URL: %v\n", key, err)
		return err
	}
	streamURL := rawURL

	epDir := a.getEpisodeDir(animeName, epNumStr)
	if err := os.MkdirAll(epDir, 0755); err != nil {
		return err
	}

	var rawContent string
	var segmentURLs []string
	maxFollow := 3
	for i := 0; i < maxFollow; i++ {
		fmt.Printf("[%s] Fetching playlist or stream (level %d): %s\n", key, i, streamURL)
		req, _ := http.NewRequestWithContext(ctx, "GET", streamURL, nil)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		if req.Header.Get("User-Agent") == "" {
			req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		}

		resp, err := downloadClient.Do(req)
		if err != nil {
			fmt.Printf("[%s] Error opening stream: %v\n", key, err)
			return err
		}
		if resp.StatusCode != http.StatusOK {
			fmt.Printf("[%s] Bad status code: %d\n", key, resp.StatusCode)
			resp.Body.Close()
			return fmt.Errorf("bad status code: %d", resp.StatusCode)
		}

		// Peek content to see if it's a playlist
		br := bufio.NewReader(resp.Body)
		peek, _ := br.Peek(512)
		peekStr := strings.TrimSpace(string(peek))

		if !strings.HasPrefix(peekStr, "#EXTM3U") {
			if i == 0 {
				fmt.Printf("[%s] Detected direct download (not HLS).\n", key)
				segmentURLs = []string{streamURL}
				resp.Body.Close()
				break
			}
			fmt.Printf("[%s] Warning: variant at level %d is not a valid HLS playlist\n", key, i)
		}

		body, _ := io.ReadAll(br)
		resp.Body.Close()
		content := string(body)

		if strings.Contains(content, "#EXT-X-STREAM-INF") {
			fmt.Printf("[%s] Detected master playlist, selecting highest quality variant...\n", key)
			variantURL := selectHighestQualityVariant(content)

			if variantURL != "" {
				baseURL, _ := url.Parse(streamURL)
				refURL, _ := url.Parse(variantURL)
				streamURL = baseURL.ResolveReference(refURL).String()
				fmt.Printf("[%s] Resolved highest quality variant URL: %s\n", key, streamURL)
				continue
			}
		}

		rawContent = content
		scanner := bufio.NewScanner(strings.NewReader(content))
		baseURL, _ := url.Parse(streamURL)

		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			u, err := url.Parse(line)
			if err != nil {
				continue
			}
			segmentURLs = append(segmentURLs, baseURL.ResolveReference(u).String())
		}
		break
	}

	if len(segmentURLs) == 0 {
		return fmt.Errorf("no segments found")
	}

	totalSegments := len(segmentURLs)
	fmt.Printf("[%s] Collected %d segments\n", key, totalSegments)
	var downloadedCount int32
	errChan := make(chan error, 1)
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5)

	updateProgress := func() {
		newCount := atomic.AddInt32(&downloadedCount, 1)
		progress := int(float64(newCount) / float64(totalSegments) * 100)
		a.progressMap.Store(key, progress)
		runtime.EventsEmit(a.ctx, "download-progress", map[string]interface{}{
			"key":       key,
			"animeName": animeName,
			"episode":   epNumStr,
			"progress":  progress,
		})
	}

	for i, sURL := range segmentURLs {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		wg.Add(1)
		go func(target string, idx int) {
			defer wg.Done()
			sem <- struct{}{}
			ext := getUrlExtension(target)
			hash := sha256.Sum256([]byte(target))
			filename := hex.EncodeToString(hash[:]) + ext

			searchPaths := []string{
				filepath.Join(epDir, filename),
				filepath.Join(a.downloadsDir, filename), // Legacy flat structure support
				filepath.Join(a.cacheDir, filename),
			}

			defer func() { <-sem }()

			for _, p := range searchPaths {
				if info, err := os.Stat(p); err == nil && info.Size() > 0 {
					updateProgress()
					return
				}
			}

			dest := filepath.Join(epDir, filename)
			onSegProgress := func(downloaded, total int64) {
				if totalSegments == 1 && total > 0 {
					p := int(float64(downloaded) / float64(total) * 100)
					// Avoid excessive event emission (emit only on percentage change)
					current, _ := a.progressMap.Load(key)
					if current != p {
						a.progressMap.Store(key, p)
						runtime.EventsEmit(a.ctx, "download-progress", map[string]interface{}{
							"key":       key,
							"animeName": animeName,
							"episode":   epNumStr,
							"progress":  p,
						})
					}
				}
			}

			if err := a.downloadSegmentWithContext(ctx, target, headers, dest, onSegProgress); err != nil {
				select {
				case errChan <- err:
				default:
				}
				return
			}

			updateProgress()
		}(sURL, i)
	}

	wg.Wait()

	var fileList []string
	for _, sURL := range segmentURLs {
		ext := getUrlExtension(sURL)
		hash := sha256.Sum256([]byte(sURL))
		fileList = append(fileList, hex.EncodeToString(hash[:])+ext)
	}

	if rawContent != "" {
		localPlaylistPath := filepath.Join(epDir, "index.m3u8")
		if err := os.WriteFile(localPlaylistPath, []byte(rawContent), 0644); err == nil {
			fmt.Printf("[%s] Saved local playlist: %s\n", key, localPlaylistPath)
		}
	}

	fmt.Printf("[%s] Starting post-processing (Remux to MP4)...\n", key)
	mp4Path := filepath.Join(epDir, "episode.mp4")

	if rawContent != "" {
		// Local index avoids network requests in FFmpeg during remux
		content := a.generateLocalM3U8(fileList)
		localM3U8Path := filepath.Join(epDir, "local_index.m3u8")
		os.WriteFile(localM3U8Path, []byte(content), 0644)

		cmd := exec.CommandContext(ctx, "ffmpeg", "-i", localM3U8Path, "-c", "copy", "-y", mp4Path)
		if err := cmd.Run(); err == nil {
			fmt.Printf("[%s] Successfully remuxed HLS to MP4: %s\n", key, mp4Path)
			a.CleanupHLSFiles(epDir, fileList)
		}
	} else if totalSegments == 1 {
		ext := getUrlExtension(segmentURLs[0])
		if strings.ToLower(ext) == ".ts" {
			hash := sha256.Sum256([]byte(segmentURLs[0]))
			filename := hex.EncodeToString(hash[:]) + ext
			tsPath := filepath.Join(epDir, filename)

			cmd := exec.CommandContext(ctx, "ffmpeg", "-i", tsPath, "-c", "copy", "-y", mp4Path)
			if err := cmd.Run(); err == nil {
				fmt.Printf("[%s] Successfully remuxed TS to MP4: %s\n", key, mp4Path)
				os.Remove(tsPath)
			}
		}
	}

	select {
	case err := <-errChan:
		fmt.Printf("[%s] Download failed with error: %v\n", key, err)
		return err
	default:
	}

	// Store manifest for deletion later
	fmt.Printf("[%s] Saving manifest...\n", key)
	manifestPath := filepath.Join(epDir, "manifest.json")
	mBytes, _ := json.Marshal(fileList)
	os.WriteFile(manifestPath, mBytes, 0644)

	// Store stream metadata for offline playback
	fmt.Printf("[%s] Saving stream metadata...\n", key)
	metadataPath := filepath.Join(epDir, "stream_metadata.json")
	meta := struct {
		URL     string            `json:"url"`
		Headers map[string]string `json:"headers"`
	}{
		URL:     streamURL, // This is the media-level URL (after following variants)
		Headers: headers,
	}
	metaBytes, _ := json.Marshal(meta)
	os.WriteFile(metadataPath, metaBytes, 0644)

	return nil
}

type progressReader struct {
	io.Reader
	Total      int64
	Downloaded int64
	OnProgress func(int64, int64)
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	pr.Downloaded += int64(n)
	if pr.OnProgress != nil {
		pr.OnProgress(pr.Downloaded, pr.Total)
	}
	return n, err
}

func (a *AnimeService) downloadSegmentWithContext(ctx context.Context, target string, headers map[string]string, dest string, onProgress func(int64, int64)) error {
	if info, err := os.Stat(dest); err == nil && info.Size() > 0 {
		return nil
	}

	maxRetries := 3
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		if i > 0 {
			fmt.Printf("[%d/%d] Retrying segment download: %s\n", i+1, maxRetries, target)
			time.Sleep(time.Duration(i) * time.Second)
		}

		err := func() error {
			req, err := http.NewRequestWithContext(ctx, "GET", target, nil)
			if err != nil {
				return err
			}
			for k, v := range headers {
				req.Header.Set(k, v)
			}
			if req.Header.Get("User-Agent") == "" {
				req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
			}

			resp, err := downloadClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("bad status: %s", resp.Status)
			}

			out, err := os.Create(dest)
			if err != nil {
				return err
			}
			defer out.Close()

			reader := &progressReader{
				Reader:     resp.Body,
				Total:      resp.ContentLength,
				OnProgress: onProgress,
			}

			_, err = io.Copy(out, reader)
			return err
		}()

		if err == nil {
			return nil
		}
		lastErr = err
		fmt.Printf("Error downloading segment %s (attempt %d): %v\n", target, i+1, err)
	}

	return lastErr
}

func (a *AnimeService) downloadSegment(target string, headers map[string]string, dest string) {
	if _, err := os.Stat(dest); err == nil {
		return // Already exists
	}

	req, _ := http.NewRequest("GET", target, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	out, _ := os.Create(dest)
	defer out.Close()
	io.Copy(out, resp.Body)
}

func (a *AnimeService) generateLocalM3U8(filenames []string) string {
	content := "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-MEDIA-SEQUENCE:0\n"
	for _, f := range filenames {
		content += fmt.Sprintf("#EXTINF:10.0,\n%s\n", f)
	}
	content += "#EXT-X-ENDLIST\n"
	return content
}

func (a *AnimeService) CleanupHLSFiles(epDir string, fileList []string) {
	fmt.Printf("[Cleanup] Deleting original segments in %s\n", epDir)
	for _, f := range fileList {
		os.Remove(filepath.Join(epDir, f))
	}
	os.Remove(filepath.Join(epDir, "index.m3u8"))
	os.Remove(filepath.Join(epDir, "local_index.m3u8"))
}
