export interface VideoItem {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  createdAt?: string;
  updatedAt?: string;
  prompt?: string;
  source?: string;
  generationId?: string;
}

// Sora-specific types matching the actual feed.json structure
export interface SoraAttachment {
  id: string;
  tags: string[];
  kind: string;
  generation_id: string;
  generation_type: string;
  url: string;
  downloadable_url: string;
  width: number;
  height: number;
  prompt: string | null;
  task_id: string | null;
  output_blocked: boolean;
  title: string | null;
  source: string | null;
  encodings: {
    source: { path: string };
    source_wm: { path: string };
    thumbnail: { path: string };
  };
}

export interface SoraPost {
  id: string;
  shared_by: string;
  is_owner: boolean;
  workspace_id: string | null;
  posted_to_public: boolean;
  posted_at: number;
  updated_at: number;
  like_count: number;
  recursive_reply_count: number;
  reply_count: number;
  view_count: number;
  unique_view_count: number;
  remix_count: number;
  user_liked: boolean;
  source: string;
  text: string;
  caption: string | null;
  cover_photo_url: string | null;
  preview_image_url: string;
  attachments: SoraAttachment[];
}

export interface SoraFeedItem {
  post: SoraPost;
}

export interface SoraFeedResponse {
  items: SoraFeedItem[];
}

export interface FeedResponse {
  videos: VideoItem[];
  total: number;
  page?: number;
  hasMore?: boolean;
}

export interface DownloadOptions {
  outputDir?: string;
  quality?: string;
  overwrite?: boolean;
}

export interface VideoMetadata {
  id: string;
  shared_by: string;
  posted_at: number;
  updated_at: number;
  text: string;
  permalink: string;
  video_url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  generation_id: string;
  download_path?: string;
}