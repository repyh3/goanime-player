package main

// JikanResponse represents the necessary part of the Jikan API response
type JikanResponse struct {
	Data []struct {
		MALID  int `json:"mal_id"`
		Images struct {
			Webp struct {
				LargeImageURL string `json:"large_image_url"`
			} `json:"webp"`
		} `json:"images"`
		Title        string `json:"title"`
		TitleEnglish string `json:"title_english"`
		Synopsis     string `json:"synopsis"`
	} `json:"data"`
}

type JikanEpisodeResponse struct {
	Data []struct {
		EpisodeID int    `json:"mal_id"`
		Title     string `json:"title"`
		Aired     string `json:"aired"`
		Filler    bool   `json:"filler"`
	} `json:"data"`
}

type EpisodeMetadata struct {
	Episode  int    `json:"episode"`
	Title    string `json:"title"`
	Synopsis string `json:"synopsis"`
	Aired    string `json:"aired"`
	Filler   bool   `json:"filler"`
}

type Metadata struct {
	Img, Desc string
	MalID     int
	Episodes  []EpisodeMetadata `json:"episodes,omitempty"`
}

// Models adapted for Wails/Frontend

type Anime struct {
	Name      string `json:"name"`
	URL       string `json:"url"`
	ImageURL  string `json:"imageUrl"`
	AnilistID int    `json:"anilistId"`
	MalID     int    `json:"malId"`
	Source    string `json:"source"`
	Synopsis  string `json:"synopsis"`
	HasDub    bool   `json:"hasDub"`
}

type Episode struct {
	Number   string  `json:"number"`
	Num      float64 `json:"num"`
	URL      string  `json:"url"`
	Title    string  `json:"title"`
	Aired    string  `json:"aired"`
	Duration float64 `json:"duration"`
	IsFiller bool    `json:"isFiller"`
	IsRecap  bool    `json:"isRecap"`
	Synopsis string  `json:"synopsis"`
}

type StreamInfo struct {
	URL          string            `json:"url"`
	Headers      map[string]string `json:"headers"`
	IsHLS        bool              `json:"isHls"`
	IsDownloaded bool              `json:"isDownloaded"`
	AnimeName    string            `json:"animeName,omitempty"`
	EpisodeNum   string            `json:"episodeNum,omitempty"`
}
