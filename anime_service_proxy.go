package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func (a *AnimeService) startProxyServer() {
	http.HandleFunc("/proxy", a.proxyHandler)
	go func() {
		fmt.Printf("Starting stream proxy on :%s\n", a.proxyPort)
		if err := http.ListenAndServe(":"+a.proxyPort, nil); err != nil {
			fmt.Printf("Proxy server error: %v\n", err)
		}
	}()
}

func (a *AnimeService) proxyHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")

	a.proxyMutex.RLock()
	streamInfo, exists := a.proxyCache[id]
	a.proxyMutex.RUnlock()

	if !exists {
		http.Error(w, "Stream not found", http.StatusNotFound)
		return
	}

	targetURL := r.URL.Query().Get("url")

	if targetURL == "" {
		epDir := a.getEpisodeDir(streamInfo.AnimeName, streamInfo.EpisodeNum)

		mp4Path := filepath.Join(epDir, "episode.mp4")
		if _, err := os.Stat(mp4Path); err == nil {
			fmt.Printf("[Proxy] Serving REMUXED MP4 for %s - Ep %s\n", streamInfo.AnimeName, streamInfo.EpisodeNum)
			http.ServeFile(w, r, mp4Path)
			return
		}

		localPlaylist := filepath.Join(epDir, "index.m3u8")
		if _, err := os.Stat(localPlaylist); err == nil {
			fmt.Printf("[Proxy] Serving LOCAL playlist for %s - Ep %s\n", streamInfo.AnimeName, streamInfo.EpisodeNum)
			a.LogProxyEvent(fmt.Sprintf("Serving LOCAL playlist (remuxed) for %s - Ep %s", streamInfo.AnimeName, streamInfo.EpisodeNum))
			data, err := os.ReadFile(localPlaylist)
			if err == nil {
				a.rewriteM3U8(w, r, string(data), streamInfo.URL, id)
				return
			}
		}
	}

	if targetURL == "" {
		targetURL = streamInfo.URL
	}

	ext := getUrlExtension(targetURL)
	isVideoSegment := ext == ".ts" || ext == ".m4s" || ext == ".mp4" || ext == ".m3u8" || ext == ".aspx" || ext == ".avi"

	if isVideoSegment {
		hash := sha256.Sum256([]byte(targetURL))
		filename := hex.EncodeToString(hash[:]) + ext
		// Only force index.m3u8 if the request is for the root playlist
		if ext == ".m3u8" && (targetURL == streamInfo.URL || !strings.Contains(targetURL, hex.EncodeToString(hash[:]))) {
			filename = "index.m3u8"
		}

		if streamInfo.AnimeName != "" && streamInfo.EpisodeNum != "" {
			epDir := a.getEpisodeDir(streamInfo.AnimeName, streamInfo.EpisodeNum)
			persistentPath := filepath.Join(epDir, filename)
			if _, err := os.Stat(persistentPath); err == nil {
				if ext == ".m3u8" {
					data, err := os.ReadFile(persistentPath)
					if err == nil {
						fmt.Printf("[Proxy] Serving LOCAL playlist from persistent storage: %s\n", filename)
						a.LogProxyEvent(fmt.Sprintf("Serving LOCAL playlist from persistent storage: %s", filename))
						a.rewriteM3U8(w, r, string(data), targetURL, id)
						return
					}
				}
				fmt.Printf("[Proxy] Serving PERSISTENT local file: %s (Path: %s)\n", filename, persistentPath)
				a.LogProxyEvent(fmt.Sprintf("Serving PERSISTENT local file: %s", filename))
				http.ServeFile(w, r, persistentPath)
				return
			}
		}

		cachePath := filepath.Join(a.cacheDir, filename)
		if _, err := os.Stat(cachePath); err == nil {
			fmt.Printf("[Proxy] Serving CACHED segment: %s\n", filename)
			a.LogProxyEvent(fmt.Sprintf("Serving CACHED segment: %s", filename))
			http.ServeFile(w, r, cachePath)
			return
		}

		fmt.Printf("[Proxy] Local file NOT FOUND: %s (Target: %s)\n", filename, targetURL)
	}

	a.LogProxyEvent(fmt.Sprintf("Proxying stream: %s", targetURL))
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Forward stored headers
	if streamInfo.Headers != nil {
		for k, v := range streamInfo.Headers {
			req.Header.Set(k, v)
		}
	}

	// Range header is required for seeking support in HLS players
	if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		http.Error(w, "Failed to fetch upstream", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for k, v := range resp.Header {
		if k == "Content-Length" || k == "Cache-Control" || k == "Pragma" || k == "Expires" || k == "ETag" {
			continue
		}
		w.Header()[k] = v
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	w.WriteHeader(resp.StatusCode)

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	isM3U8 := strings.Contains(contentType, "mpegurl") || strings.Contains(contentType, "m3u8") || strings.HasSuffix(targetURL, ".m3u8") || strings.HasSuffix(targetURL, ".m3u")

	if isM3U8 {
		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			fmt.Printf("Failed to read m3u8 body: %v\n", err)
			a.LogProxyEvent(fmt.Sprintf("Failed to read m3u8 body: %v", err))
			return
		}
		a.rewriteM3U8(w, r, string(bodyBytes), targetURL, id)
		return
	}

	if isVideoSegment {
		hash := sha256.Sum256([]byte(targetURL))
		filename := hex.EncodeToString(hash[:]) + ext
		cachePath := filepath.Join(a.cacheDir, filename)

		out, err := os.Create(cachePath)
		if err != nil {
			fmt.Printf("Failed to create cache file: %v\n", err)
			io.Copy(w, resp.Body)
			return
		}

		mw := io.MultiWriter(w, out)
		_, err = io.Copy(mw, resp.Body)
		out.Close()
		if err != nil {
			os.Remove(cachePath)
		}
		return
	}

	// Fallback for everything else
	io.Copy(w, resp.Body)
}

func (a *AnimeService) rewriteM3U8(w http.ResponseWriter, r *http.Request, content string, targetURL string, id string) {
	baseURL, err := url.Parse(targetURL)
	if err != nil {
		fmt.Printf("Failed to parse base URL: %v\n", err)
		w.Write([]byte(content))
		return
	}

	var lines []string
	scanner := bufio.NewScanner(strings.NewReader(content))
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			lines = append(lines, line)
			continue
		}

		refURL, err := url.Parse(trimmed)
		if err != nil {
			lines = append(lines, line)
			continue
		}
		absURL := baseURL.ResolveReference(refURL).String()

		newLine := fmt.Sprintf("http://localhost:%s/proxy?id=%s&url=%s", a.proxyPort, id, url.QueryEscape(absURL))
		lines = append(lines, newLine)
	}

	newContent := strings.Join(lines, "\n")
	w.Header().Set("Content-Length", strconv.Itoa(len(newContent)))
	w.Write([]byte(newContent))
}
