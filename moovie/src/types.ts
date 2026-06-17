export interface Movie {
  id: string;
  title: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  rating: number;
  releaseDate: string;
  duration?: string;
  resolution?: "4K UHD" | "1080p HDR" | "HDR10" | "8K IMAX";
  audioCodec?: string;
  genre: string;
  auraColor: string; // Dynamic glow color
  trailerUrl?: string; // Simulated link or stream
  visualVibe?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: string;
  glowColor: string;
  isCustom?: boolean;
}

export type ThemePalette = "crimson" | "purple" | "midnight" | "emerald";

export type AudioPhase = "stereo" | "spatial3d";

export interface PlayerSettings {
  resolutionMultiplier: "720p" | "1080p" | "4k" | "original";
  audioPhase: AudioPhase;
  subtitleStyle: "flat" | "glow" | "shadow";
  activeSubtitleText: string;
  bitrateDiagnosticEnabled: boolean;
}

export interface Recommendation {
  title: string;
  reason: string;
  auraColor: string;
  visualVibe: string;
}
