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
			// Extract BANDWIDTH
			tags := line[len("#EXT-X-STREAM-INF:"):]
			parts := strings.Split(tags, ",")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if strings.HasPrefix(p, "BANDWIDTH=") {
					bwStr := p[len("BANDWIDTH="):]
					// Remove anything after comma if split failed or unexpected
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

	// Remove [...] and (...) at the start iteratively
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

	// Remove episode/version info like "(24 episodes)", "(Dub)", "(Sub)"
	if idx := strings.LastIndex(cleaned, "("); idx != -1 {
		lower := strings.ToLower(cleaned[idx:])
		if strings.Contains(lower, "episode") || strings.Contains(lower, "eps") || strings.Contains(lower, "dub") || strings.Contains(lower, "sub") {
			cleaned = cleaned[:idx]
		}
	}

	// Remove trailing noise symbols and keywords
	cleaned = strings.TrimSpace(cleaned)
	cleaned = strings.TrimSuffix(cleaned, ":")
	cleaned = strings.TrimSuffix(cleaned, "-")
	cleaned = strings.TrimSuffix(cleaned, "*") // Strip trailing asterisks (often used for sequels)
	cleaned = strings.TrimSpace(cleaned)

	return cleaned
}

// normalizeTitle provides a canonical form for title comparison
func normalizeTitle(title string) string {
	// Lowercase
	s := strings.ToLower(title)
	// Remove all symbols except alphanumeric and spaces
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' {
			b.WriteRune(r)
		}
	}
	s = b.String()
	// Consolidate whitespace
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

// calculateSimilarity returns a score from 0-100 indicating how similar two titles are
func calculateSimilarity(source, target string) int {
	s1 := normalizeTitle(source)
	s2 := normalizeTitle(target)

	if s1 == "" || s2 == "" {
		return 0
	}

	if s1 == s2 {
		return 100
	}

	// Base contains or vice versa
	if strings.Contains(s1, s2) || strings.Contains(s2, s1) {
		// Penalty for length difference
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
	// Robustly strip query and fragment manually first
	base := rawURL
	if idx := strings.IndexAny(base, "?#"); idx != -1 {
		base = base[:idx]
	}
	// Then parse as URL to handle any remaining weirdness in the path
	u, err := url.Parse(base)
	if err != nil {
		return filepath.Ext(base)
	}
	return filepath.Ext(u.Path)
}
