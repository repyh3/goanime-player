import { Search, GetEpisodes, GetStreamUrl } from '../../wailsjs/go/main/AnimeService';
import { Anime, Episode, StreamResponse } from '../types/anime';

export const animeService = {
    search: async (query: string): Promise<Anime[]> => {
        return await (window as any).go.main.AnimeService.Search(query);
    },
    getEpisodes: async (anime: Anime, isDub: boolean = false): Promise<Episode[]> => {
        return await (window as any).go.main.AnimeService.GetEpisodes(anime.name, anime.url, anime.malId || 0, anime.source, isDub);
    },
    getStreamUrl: async (anime: Anime, episode: Episode, isDub: boolean = false): Promise<StreamResponse> => {
        return await (window as any).go.main.AnimeService.GetStreamUrl(
            anime.name,
            anime.url,
            anime.source,
            episode.number,
            episode.url,
            episode.num,
            isDub
        );
    },
    getEpisodeMetadata: async (malId: number, epNum: number): Promise<any> => {
        return await (window as any).go.main.AnimeService.GetEpisodeMetadata(malId, epNum);
    },
    downloadEpisode: async (anime: Anime, episode: Episode, isDub: boolean = false): Promise<void> => {
        // Use full path to avoid ambiguity if needed, but 'main' often suffices
        return await (window as any).go.main.AnimeService.DownloadEpisode(
            anime.name,
            anime.url,
            anime.source,
            episode.number,
            episode.url,
            episode.num,
            isDub
        );
    },
    deleteDownload: async (animeName: string, epNumStr: string): Promise<void> => {
        return await (window as any).go.main.AnimeService.DeleteDownload(animeName, epNumStr);
    },
    checkDownloadStatus: async (animeName: string, epNumStr: string): Promise<boolean> => {
        return await (window as any).go.main.AnimeService.CheckDownloadStatus(animeName, epNumStr);
    },
    getDownloads: async (): Promise<Record<string, string[]>> => {
        return await (window as any).go.main.AnimeService.GetDownloads();
    },
    pauseDownload: async (animeName: string, epNumStr: string): Promise<void> => {
        return await (window as any).go.main.AnimeService.PauseDownload(animeName, epNumStr);
    },
    resumeDownload: async (anime: any, episode: any): Promise<void> => {
        // Reuse downloadEpisode for resume
        return await (window as any).go.main.AnimeService.DownloadEpisode(
            anime.name,
            anime.url,
            anime.source,
            episode.number,
            episode.url,
            episode.num
        );
    },
    getActiveDownloads: async (): Promise<Record<string, number>> => {
        return await (window as any).go.main.AnimeService.GetActiveDownloads();
    }
};
