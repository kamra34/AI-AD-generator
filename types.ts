export interface VideoIdea {
  title: string;
  description: string;
  visuals: string;
  promptForVideo: string;
}

export type AspectRatio = "16:9" | "9:16";

export interface RefinementSuggestions {
  styles: string[];
  environments: string[];
  lightings: string[];
  details: string[];
  recommendedDuration: number;
}

export interface MediaItem {
  id: string;
  type: 'image';
  file: File | null; // Can be null for pre-loaded images
  previewUrl: string;
  base64: string;
  mimeType: string;
  isPreloaded?: boolean;
}
