package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/alvarorichard/Goanime/pkg/goanime"
	"github.com/alvarorichard/Goanime/pkg/goanime/types"
)

// Search searches for anime and enriches with high-quality covers
func (a *AnimeService) Search(query string) ([]Anime, error) {
	fmt.Printf("Searching for: %s\n", query)
	gaAnimes, err := a.client.SearchAnime(query, nil)
	if err != nil {
		// If it's a "no anime found" error, return empty slice instead of system error
		if strings.Contains(err.Error(), "no anime found") {
			return []Anime{}, nil
		}
		return nil, err
	}

	results := mapAnimeList(gaAnimes)

	// Enrich with better images and synopsis from Jikan concurrently
	// Limit to top 10 results to avoid heavy rate limiting and long waits
	limit := len(results)
	if limit > 10 {
		limit = 10
	}

	var wg sync.WaitGroup
	for i := 0; i < limit; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			metadataTitle := cleanTitle(results[idx].Name)
			img, desc, malID := fetchAnimeMetadata(metadataTitle)
			if img != "" {
				results[idx].ImageURL = img
			}
			if desc != "" {
				results[idx].Synopsis = desc
			}
			if malID > 0 {
				results[idx].MalID = malID
			}
		}(i)
	}
	wg.Wait()

	// Post-search sorting: Re-rank results by similarity to user query
	// This helps with "The Quintessential Quintuplets" case by pushing exact/close matches to top
	sort.Slice(results, func(i, j int) bool {
		scoreI := calculateSimilarity(query, results[i].Name)
		scoreJ := calculateSimilarity(query, results[j].Name)
		return scoreI > scoreJ
	})

	return results, nil
}

// GetEpisodeMetadata fetches specific metadata for an episode (on-demand)
func (a *AnimeService) GetEpisodeMetadata(malID int, epNum int) (*EpisodeMetadata, error) {
	fmt.Printf("Fetching metadata for MAL ID: %d, Episode: %d\n", malID, epNum)

	// Check cache first (using actual MalID key if possible or iterating)
	cacheMutex.RLock()
	// Optimization: If the MalID is used as a key in the map (it often is for Jikan searches)
	// we should try direct lookup, but the map keys are currently strings (cleaned titles).
	// So we still need to iterate or fix the keying.
	for _, v := range metadataCache {
		if v.MalID == malID {
			for _, ep := range v.Episodes {
				if ep.Episode == epNum {
					cacheMutex.RUnlock()
					return &ep, nil
				}
			}
		}
	}
	cacheMutex.RUnlock()

	// Fetch from Jikan
	epURL := fmt.Sprintf("https://api.jikan.moe/v4/anime/%d/episodes/%d", malID, epNum)
	resp, err := throttledGet(epURL)
	if err != nil || resp == nil {
		return nil, fmt.Errorf("failed to fetch episode metadata")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jikan api error: %s", resp.Status)
	}

	var result struct {
		Data EpisodeMetadata `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Update cache for ALL entries sharing this MalID (fixes "bleeding" / missing updates)
	cacheMutex.Lock()
	for k, v := range metadataCache {
		if v.MalID == malID {
			found := false
			for i, ep := range v.Episodes {
				if ep.Episode == epNum {
					v.Episodes[i] = result.Data
					found = true
					break
				}
			}
			if !found {
				v.Episodes = append(v.Episodes, result.Data)
			}
			metadataCache[k] = v
		}
	}
	cacheMutex.Unlock()
	a.saveCache()

	return &result.Data, nil
}

func (a *AnimeService) fetchFullMetadata(malID int) (*Metadata, error) {
	k := strconv.Itoa(malID)
	cacheMutex.RLock()
	if v, ok := metadataCache[k]; ok {
		cacheMutex.RUnlock()
		return &v, nil
	}
	cacheMutex.RUnlock()

	jikanURL := fmt.Sprintf("https://api.jikan.moe/v4/anime/%d/episodes", malID)
	jikanMutex.Lock()
	if time.Since(lastJikanRequest) < 500*time.Millisecond {
		time.Sleep(500*time.Millisecond - time.Since(lastJikanRequest))
	}
	resp, err := http.Get(jikanURL)
	lastJikanRequest = time.Now()
	jikanMutex.Unlock()

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []EpisodeMetadata `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	v := Metadata{Episodes: result.Data, MalID: malID}
	cacheMutex.Lock()
	metadataCache[k] = v
	cacheMutex.Unlock()
	a.saveCache()

	return &v, nil
}

// GetStreamUrl fetches a stream URL and registers it with the proxy for the frontend
func (a *AnimeService) GetStreamUrl(animeName, animeURL, animeSource, epNumStr, epURL string, epNum float64, isDub bool) (*StreamInfo, error) {
	resURL, headers, err := a.ResolveStreamURL(animeName, animeURL, animeSource, epNumStr, epURL, epNum, isDub)
	if err != nil {
		return nil, err
	}

	// Determine if HLS based on extension
	isHLS := strings.Contains(strings.ToLower(resURL), ".m3u8")
	// OFFLINE OVERRIDE: Check for local files
	epDir := a.getEpisodeDir(animeName, epNumStr)
	if _, err := os.Stat(filepath.Join(epDir, "episode.mp4")); err == nil {
		// If we have a remuxed MP4, it's NOT HLS anymore
		isHLS = false
	} else if _, err := os.Stat(filepath.Join(epDir, "index.m3u8")); err == nil {
		// If we have an HLS playlist, it IS HLS
		isHLS = true
		// BACKGROUND UPGRADE: Trigger conversion to MP4 for existing HLS downloads
		go func() {
			manifestPath := filepath.Join(epDir, "manifest.json")
			mBytes, err := os.ReadFile(manifestPath)
			if err != nil {
				return
			}
			var fileList []string
			if err := json.Unmarshal(mBytes, &fileList); err != nil {
				return
			}

			localM3U8 := a.generateLocalM3U8(fileList)
			localM3U8Path := filepath.Join(epDir, "local_index.m3u8")
			os.WriteFile(localM3U8Path, []byte(localM3U8), 0644)

			mp4Path := filepath.Join(epDir, "episode.mp4")
			fmt.Printf("[Maintenance] Triggering background remux for %s\n", mp4Path)
			if err := exec.Command("ffmpeg", "-i", localM3U8Path, "-c", "copy", "-y", mp4Path).Run(); err == nil {
				a.CleanupHLSFiles(epDir, fileList)
			}
		}()
	} else if a.CheckDownloadStatus(animeName, epNumStr) {
		// If it's a single .ts file download, force HLS (fallback for single files not yet remuxed)
		if getUrlExtension(resURL) == ".ts" {
			isHLS = true
			// BACKGROUND UPGRADE: Trigger conversion for single TS file
			// We need to find the hashed filename... or we can just let proxy handle it for now
			// Actually, let's keep it simple. New downloads will have episode.mp4.
		}
	}

	id := strconv.FormatInt(time.Now().UnixNano(), 10)
	proxyURL := fmt.Sprintf("http://localhost:%s/proxy?id=%s", a.proxyPort, id)

	// Register with proxy early
	a.proxyMutex.Lock()
	a.proxyCache[id] = &StreamInfo{
		URL:        resURL,
		Headers:    headers,
		AnimeName:  animeName,
		EpisodeNum: epNumStr,
		IsHLS:      isHLS,
	}
	a.proxyMutex.Unlock()

	// If already downloaded, return immediately (skips remote quality check)
	if a.CheckDownloadStatus(animeName, epNumStr) {
		fmt.Printf("[%s] Found downloaded content, serving via proxy: %s\n", animeName, proxyURL)
		return &StreamInfo{
			URL:          proxyURL,
			Headers:      headers,
			IsHLS:        isHLS,
			IsDownloaded: true,
			AnimeName:    animeName,
			EpisodeNum:   epNumStr,
		}, nil
	}

	// Optional: Fetch master playlist to select highest quality for STREAMING too
	if isHLS {
		req, _ := http.NewRequest("GET", resURL, nil)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		resp, err := httpClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				body, _ := io.ReadAll(resp.Body)
				content := string(body)
				if strings.Contains(content, "#EXT-X-STREAM-INF") {
					bestVariant := selectHighestQualityVariant(content)
					if bestVariant != "" {
						baseURL, _ := url.Parse(resURL)
						variantURL, _ := baseURL.Parse(bestVariant)
						resURL = variantURL.String()
						fmt.Printf("Selected highest quality variant for streaming: %s\n", resURL)

						// Update proxy cache with specific variant
						a.proxyMutex.Lock()
						a.proxyCache[id].URL = resURL
						a.proxyMutex.Unlock()
					}
				}
			}
		}
	}

	fmt.Printf("Proxying stream: %s -> %s (IsHLS: %v)\n", resURL, proxyURL, isHLS)

	return &StreamInfo{
		URL:     proxyURL,
		Headers: headers,
		IsHLS:   isHLS,
	}, nil
}

// ResolveStreamURL gets the RAW stream URL and headers (internal helper)
func (a *AnimeService) ResolveStreamURL(animeName, animeURL, animeSource, epNumStr, epURL string, epNum float64, isDub bool) (string, map[string]string, error) {
	// OFFLINE SUPPORT: Check if metadata already exists
	epDir := a.getEpisodeDir(animeName, epNumStr)
	metadataPath := filepath.Join(epDir, "stream_metadata.json")

	var resURL string
	var headers map[string]string

	if _, err := os.Stat(metadataPath); err == nil {
		fmt.Printf("[%s] Loading stream metadata from local storage\n", animeName)
		data, err := os.ReadFile(metadataPath)
		if err == nil {
			var meta struct {
				URL     string            `json:"url"`
				Headers map[string]string `json:"headers"`
			}
			if err := json.Unmarshal(data, &meta); err == nil {
				resURL = meta.URL
				headers = meta.Headers
			}
		}
	}

	if resURL == "" {
		gaAnime := &types.Anime{Name: animeName, URL: animeURL, Source: animeSource}
		gaEpisode := &types.Episode{Number: epNumStr, Num: int(epNum), URL: epURL}

		opts := goanime.DefaultStreamOptions()
		if isDub {
			opts.Mode = "dub"
		}
		var err error
		resURL, headers, err = a.client.GetEpisodeStreamURL(gaAnime, gaEpisode, &opts)
		if err != nil {
			return "", nil, err
		}
	}

	if resURL == "" {
		return "", nil, fmt.Errorf("failed to resolve stream URL")
	}

	return resURL, headers, nil
}

func mapAnimeList(src []*types.Anime) []Anime {
	out := make([]Anime, len(src))
	for i, a := range src {
		out[i] = Anime{
			Name:      cleanTitle(a.Name),
			URL:       a.URL,
			ImageURL:  a.ImageURL,
			AnilistID: a.AnilistID,
			MalID:     a.MalID,
			Source:    a.Source,
			HasDub:    a.HasDub,
		}
	}
	return out
}

func mapEpisodeList(src []*types.Episode) []Episode {
	out := make([]Episode, len(src))
	for i, e := range src {
		out[i] = Episode{
			Number:   e.Number,
			Num:      float64(e.Num),
			URL:      e.URL,
			Title:    e.Title.Romaji,
			Aired:    e.Aired,
			Duration: float64(e.Duration),
			IsFiller: e.IsFiller,
			IsRecap:  e.IsRecap,
			Synopsis: e.Synopsis,
		}
	}
	return out
}

// Helpers

// throttledGet performs a GET request with rate limiting and retries
func throttledGet(url string) (*http.Response, error) {
	jikanMutex.Lock()

	// Jikan API allows 3 requests per second for public API
	// We'll be conservative and wait 1 second between requests
	elapsed := time.Since(lastJikanRequest)
	if elapsed < time.Second {
		time.Sleep(time.Second - elapsed)
	}

	var resp *http.Response
	var err error

	// Retry logic with exponential backoff
	backoff := time.Second
	for i := 0; i < 3; i++ {
		resp, err = httpClient.Get(url)
		if err == nil && resp.StatusCode == http.StatusOK {
			lastJikanRequest = time.Now()
			jikanMutex.Unlock()
			return resp, nil
		}

		if resp != nil {
			if resp.StatusCode == 429 {
				fmt.Printf("Jikan Rate Limit (429) hit, retrying in %v... (attempt %d/3)\n", backoff, i+1)
				resp.Body.Close()
				time.Sleep(backoff)
				backoff *= 2
				continue
			}
			resp.Body.Close()
		}

		if err != nil {
			fmt.Printf("Jikan request error: %v, retrying...\n", err)
			time.Sleep(backoff)
			backoff *= 2
			continue
		}

		// If not 200 and not 429, don't retry
		break
	}

	lastJikanRequest = time.Now()
	jikanMutex.Unlock()
	return resp, err
}

func fetchAnimeMetadata(title string) (string, string, int) {
	cleaned := cleanTitle(title)

	cacheMutex.RLock()
	if meta, ok := metadataCache[cleaned]; ok {
		cacheMutex.RUnlock()
		return meta.Img, meta.Desc, meta.MalID
	}
	cacheMutex.RUnlock()

	searchURL := fmt.Sprintf("https://api.jikan.moe/v4/anime?q=%s&limit=5", url.QueryEscape(cleaned))

	resp, err := throttledGet(searchURL)
	if err != nil || resp == nil {
		fmt.Printf("Jikan search error for %s: %v\n", cleaned, err)
		return "", "", 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Jikan search status %d for %s\n", resp.StatusCode, cleaned)
		return "", "", 0
	}

	var jikan JikanResponse
	if err := json.NewDecoder(resp.Body).Decode(&jikan); err != nil {
		fmt.Printf("Jikan decode error for %s: %v\n", cleaned, err)
		return "", "", 0
	}

	if len(jikan.Data) > 0 {
		// Pick the best match among the top 5 results
		bestIdx := 0
		maxSimilarity := -1
		for i, data := range jikan.Data {
			// Compare cleaned titles
			sim := calculateSimilarity(cleaned, data.Title)
			// Also check English title if available
			if data.TitleEnglish != "" {
				if engSim := calculateSimilarity(cleaned, data.TitleEnglish); engSim > sim {
					sim = engSim
				}
			}
			if sim > maxSimilarity {
				maxSimilarity = sim
				bestIdx = i
			}
		}

		best := jikan.Data[bestIdx]
		img := best.Images.Webp.LargeImageURL
		desc := best.Synopsis
		malID := best.MALID

		fmt.Printf("Found Jikan Metadata for %s: MAL ID %d (Similarity: %d)\n", cleaned, malID, maxSimilarity)

		cacheMutex.Lock()
		if existing, ok := metadataCache[cleaned]; ok {
			existing.Img = img
			existing.Desc = desc
			existing.MalID = malID
			metadataCache[cleaned] = existing
		} else {
			metadataCache[cleaned] = Metadata{
				Img:   img,
				Desc:  desc,
				MalID: malID,
			}
		}
		cacheMutex.Unlock()
		return img, desc, malID
	}

	fmt.Printf("No Jikan results found for %s\n", cleaned)
	return "", "", 0
}

func fetchEpisodeMetadata(malID int) []EpisodeMetadata {
	epURL := fmt.Sprintf("https://api.jikan.moe/v4/anime/%d/episodes", malID)

	resp, err := throttledGet(epURL)
	if err != nil || resp == nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var jikan JikanEpisodeResponse
	if err := json.NewDecoder(resp.Body).Decode(&jikan); err != nil {
		return nil
	}

	var out []EpisodeMetadata
	for _, d := range jikan.Data {
		// Format date if possible
		aired := d.Aired
		if len(aired) > 10 {
			aired = aired[:10] // Keep YYYY-MM-DD
		}

		out = append(out, EpisodeMetadata{
			Episode: d.EpisodeID,
			Title:   d.Title,
			Aired:   aired,
			Filler:  d.Filler,
		})
	}

	return out
}
