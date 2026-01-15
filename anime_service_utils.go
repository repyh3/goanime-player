package main

import (
	"bufio"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
)

func selectHighestQualityVariant(content string) string {
	scanner := bufio.NewScanner(strings.NewReader(content))
	var bestVariant string
	var maxBandwidth int64
	var currentBandwidth int64

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "#EXT-X-STREAM-INF:") {
			tags := line[len("#EXT-X-STREAM-INF:"):]
			parts := strings.Split(tags, ",")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if strings.HasPrefix(p, "BANDWIDTH=") {
					bwStr := p[len("BANDWIDTH="):]
					if idx := strings.Index(bwStr, ","); idx != -1 {
						bwStr = bwStr[:idx]
					}
					currentBandwidth, _ = strconv.ParseInt(bwStr, 10, 64)
					break
				}
			}
		} else if line != "" && !strings.HasPrefix(line, "#") {
			if currentBandwidth >= maxBandwidth {
				maxBandwidth = currentBandwidth
				bestVariant = line
			}
		}
	}
	return bestVariant
}

func sanitizeFilename(name string) string {
	r := strings.NewReplacer(
		"<", "", ">", "", ":", "", "\"", "", "/", "_", "\\", "_", "|", "", "?", "", "*", "",
	)
	return strings.TrimSpace(r.Replace(name))
}

func cleanTitle(title string) string {
	cleaned := title

	for {
		changed := false
		trimmed := strings.TrimSpace(cleaned)
		if strings.HasPrefix(trimmed, "[") {
			if endIdx := strings.Index(trimmed, "]"); endIdx != -1 {
				cleaned = trimmed[endIdx+1:]
				changed = true
			}
		} else if strings.HasPrefix(trimmed, "(") {
			if endIdx := strings.Index(trimmed, ")"); endIdx != -1 {
				cleaned = trimmed[endIdx+1:]
				changed = true
			}
		}
		if !changed {
			break
		}
	}

	if idx := strings.LastIndex(cleaned, "("); idx != -1 {
		lower := strings.ToLower(cleaned[idx:])
		if strings.Contains(lower, "episode") || strings.Contains(lower, "eps") || strings.Contains(lower, "dub") || strings.Contains(lower, "sub") {
			cleaned = cleaned[:idx]
		}
	}

	cleaned = strings.TrimSpace(cleaned)
	cleaned = strings.TrimSuffix(cleaned, ":")
	cleaned = strings.TrimSuffix(cleaned, "-")
	cleaned = strings.TrimSuffix(cleaned, "*")
	cleaned = strings.TrimSpace(cleaned)

	return cleaned
}

func normalizeTitle(title string) string {
	s := strings.ToLower(title)
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' {
			b.WriteRune(r)
		}
	}
	s = b.String()
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

func calculateSimilarity(source, target string) int {
	s1 := normalizeTitle(source)
	s2 := normalizeTitle(target)

	if s1 == "" || s2 == "" {
		return 0
	}

	if s1 == s2 {
		return 100
	}

	if strings.Contains(s1, s2) || strings.Contains(s2, s1) {
		diff := len(s1) - len(s2)
		if diff < 0 {
			diff = -diff
		}
		score := 80 - diff
		if score < 0 {
			score = 0
		}
		return score
	}

	return 0
}

func (a *AnimeService) getEpisodeDir(animeName, epNumStr string) string {
	return filepath.Join(a.downloadsDir, sanitizeFilename(animeName), sanitizeFilename(epNumStr))
}

func getUrlExtension(rawURL string) string {
	base := rawURL
	if idx := strings.IndexAny(base, "?#"); idx != -1 {
		base = base[:idx]
	}
	u, err := url.Parse(base)
	if err != nil {
		return filepath.Ext(base)
	}
	return filepath.Ext(u.Path)
}
