export interface Anime {
    name: string;
    url: string;
    imageUrl: string;
    anilistId: number;
    malId: number;
    source: string;
    synopsis?: string;
    hasDub?: boolean;
}

export interface Episode {
    number: string;
    num: number;
    url: string;
    title: string;
    aired: string;
    duration: number;
    isFiller: boolean;
    isRecap: boolean;
    synopsis: string;
    hasDub?: boolean;
    dubId?: string;
    dubUrl?: string;
}

export interface StreamResponse {
    url: string;
    headers: Record<string, string>;
    isHls: boolean;
    isDownloaded: boolean;
}
