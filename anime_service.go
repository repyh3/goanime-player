package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/alvarorichard/Goanime/pkg/goanime"
	"github.com/alvarorichard/Goanime/pkg/goanime/types"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	metadataCache     = make(map[string]Metadata)
	cacheMutex        sync.RWMutex
	jikanMutex        sync.Mutex
	lastJikanRequest  time.Time
	httpClient        = &http.Client{Timeout: 120 * time.Second}
	downloadClient    = &http.Client{Timeout: 0}
	metadataCachePath string
)

type AnimeService struct {
	ctx          context.Context
	client       *goanime.Client
	proxyCache   map[string]*StreamInfo
	proxyPort    string
	proxyMutex   sync.RWMutex
	cacheDir     string
	downloadsDir string
	progressMap  sync.Map
	cancelFuncs  map[string]context.CancelFunc
	cancelMutex  sync.RWMutex
}

func NewAnimeService() *AnimeService {
	homeDir, _ := os.UserHomeDir()
	appDataDir := filepath.Join(homeDir, "AppData", "Roaming", "goanime")
	cacheDir := filepath.Join(appDataDir, "cache")
	downloadsDir := filepath.Join(appDataDir, "downloads")

	os.MkdirAll(cacheDir, 0755)
	os.MkdirAll(downloadsDir, 0755)

	metadataCachePath = filepath.Join(appDataDir, "metadata_cache.json")

	return &AnimeService{
		client:       goanime.NewClient(),
		proxyCache:   make(map[string]*StreamInfo),
		proxyPort:    "34116",
		cacheDir:     cacheDir,
		downloadsDir: downloadsDir,
		cancelFuncs:  make(map[string]context.CancelFunc),
	}
}

func (a *AnimeService) GetDubbedAnime(currentName string) (*Anime, error) {
	fmt.Printf("[DubCheck] Searching for alternate version of: %s\n", currentName)

	var searchQuery string
	baseName := currentName
	if strings.Contains(strings.ToLower(currentName), "(dub)") {
		baseName = strings.ReplaceAll(currentName, " (Dub)", "")
		baseName = strings.ReplaceAll(baseName, " (dub)", "")
		baseName = strings.TrimSpace(baseName)
		searchQuery = baseName
	} else {
		searchQuery = currentName + " (Dub)"
	}

	results, err := a.Search(searchQuery)
	if err != nil {
		return nil, err
	}

	var bestMatch *Anime
	bestScore := -1

	for i := range results {
		res := results[i]
		if !res.HasDub {
			continue
		}

		score := calculateSimilarity(baseName, res.Name)
		resNameLower := strings.ToLower(res.Name)
		normalizedBaseLower := strings.ToLower(baseName)

		keywords := []string{"recap", "special", "part", "movie", "ova", "ona", "preview", "theatrical", "season 2", "season 3", "2nd season", "3rd season"}
		for _, kw := range keywords {
			if strings.Contains(resNameLower, kw) && !strings.Contains(normalizedBaseLower, kw) {
				score -= 40
			}
		}

		if strings.Contains(resNameLower, "*") && !strings.Contains(normalizedBaseLower, "*") {
			score -= 30
		}

		fmt.Printf("[DubCheck] Considering: %s, Score: %d\n", res.Name, score)

		if score > bestScore {
			bestScore = score
			bestMatch = &results[i]
		}
	}

	if bestMatch == nil || bestScore < 0 {
		return nil, fmt.Errorf("no suitable dubbed version found (best score: %d)", bestScore)
	}

	fmt.Printf("[DubCheck] Resolved version: %s (Score: %d)\n", bestMatch.Name, bestScore)
	return bestMatch, nil
}

func (a *AnimeService) startup(ctx context.Context) {
	a.ctx = ctx
	a.loadCache()
	a.startProxyServer()
	fmt.Println("AnimeService initialized")
}

func (a *AnimeService) GetEpisodes(name, animeURL string, animeID int, sourceStr string, isDub bool) ([]Episode, error) {
	fmt.Printf("[GetEpisodes] name: %s, url: %s, source: %s, isDub: %v\n", name, animeURL, sourceStr, isDub)

	source, err := types.ParseSource(sourceStr)
	if err != nil {
		return nil, fmt.Errorf("invalid source: [%s]", sourceStr)
	}

	targetURL := animeURL

	if isDub && source == types.SourceAllAnime && !strings.HasSuffix(animeURL, ":dub") {
		testURL := animeURL + ":dub"
		fmt.Printf("[DubCheck] Trying suffix-first for AllAnime: %s\n", testURL)
		eps, err := a.client.GetAnimeEpisodes(testURL, source)
		if err == nil && len(eps) > 0 {
			fmt.Printf("[DubCheck] Success! Suffix-first returned %d episodes\n", len(eps))
			var episodes []Episode
			for _, ep := range eps {
				episodes = append(episodes, Episode{
					Number: ep.Number,
					URL:    ep.URL,
				})
			}
			return episodes, nil
		}
	}

	if isDub && !strings.HasSuffix(animeURL, ":dub") {
		fmt.Printf("[DubCheck] Resolving dubbed version via search for: %s\n", name)
		dubAnime, err := a.GetDubbedAnime(name)
		if err == nil && dubAnime != nil {
			fmt.Printf("[DubCheck] Resolved dubbed URL: %s\n", dubAnime.URL)
			targetURL = dubAnime.URL
		}
	}

	if isDub && source == types.SourceAllAnime && !strings.HasSuffix(targetURL, ":dub") {
		targetURL += ":dub"
	}

	rawEpisodes, err := a.client.GetAnimeEpisodes(targetURL, source)
	if err != nil {
		fmt.Printf("Error fetching episodes: %v\n", err)
		return nil, err
	}

	var episodes []Episode
	for _, ep := range rawEpisodes {
		episodes = append(episodes, Episode{
			Number: ep.Number,
			URL:    ep.URL,
		})
	}

	return episodes, nil
}

func (a *AnimeService) ClearCache() {
	fmt.Println("Clearing video cache...")
	if err := os.RemoveAll(a.cacheDir); err != nil {
		fmt.Printf("Failed to clear cache: %v\n", err)
	}
	os.MkdirAll(a.cacheDir, 0755)
}

func (a *AnimeService) loadCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	data, err := os.ReadFile(metadataCachePath)
	if err != nil {
		if !os.IsNotExist(err) {
			fmt.Printf("Error reading cache file: %v\n", err)
		}
		return
	}

	if len(data) == 0 {
		return
	}

	if err := json.Unmarshal(data, &metadataCache); err != nil {
		fmt.Printf("Error unmarshaling cache (resetting): %v\n", err)
		metadataCache = make(map[string]Metadata)
		return
	}
	fmt.Printf("Loaded %d items from cache\n", len(metadataCache))
}

func (a *AnimeService) saveCache() {
	cacheMutex.RLock()
	defer cacheMutex.RUnlock()

	data, err := json.MarshalIndent(metadataCache, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling cache: %v\n", err)
		return
	}

	if err := os.WriteFile(metadataCachePath, data, 0644); err != nil {
		fmt.Printf("Error saving cache: %v\n", err)
	}
}

func (a *AnimeService) LogProxyEvent(message string) {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "proxy:log", message)
	}
}
