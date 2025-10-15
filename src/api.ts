import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { FeedResponse, VideoItem, SoraFeedResponse, SoraAttachment, SoraPost } from './types';

export class SoraAPI {
  private client: AxiosInstance;
  private baseURL: string = 'https://sora.chatgpt.com/backend/public/nf2';

  constructor(cookies?: string) {
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,ja;q=0.6',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://sora.chatgpt.com/',
        'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        ...(cookies && { 'Cookie': cookies })
      }
    });
  }

  async getRawFeed(): Promise<any> {
    const maxAttempts = 3;
    const baseDelayMs = 500;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response: AxiosResponse = await this.client.get('/feed', { timeout: 15000 });
        return response.data;
      } catch (error) {
        const isAxios = axios.isAxiosError(error);
        const message = isAxios ? error.message : String(error);
        const retriable = isAxios && (
          message.includes('ECONNRESET') ||
          message.includes('socket hang up') ||
          message.includes('ETIMEDOUT') ||
          message.includes('ENETUNREACH') ||
          message.includes('EAI_AGAIN')
        );

        if (attempt < maxAttempts && retriable) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (isAxios) {
          throw new Error(`API request failed: ${message}`);
        }
        throw error;
      }
    }
  }

  async getFeed(): Promise<FeedResponse> {
    try {
      const data = await this.getRawFeed();

      // Handle different possible response structures
      let videos: VideoItem[] = [];
      let total = 0;

      if (Array.isArray(data)) {
        // Direct array response
        videos = data.map(this.normalizeVideoItem);
        total = videos.length;
      } else if (data.videos && Array.isArray(data.videos)) {
        // Object with videos array
        videos = data.videos.map(this.normalizeVideoItem);
        total = data.total || videos.length;
      } else if (data.data && Array.isArray(data.data)) {
        // Object with data array
        videos = data.data.map(this.normalizeVideoItem);
        total = data.total || videos.length;
      } else if (data.items && Array.isArray(data.items)) {
        // Sora feed shape: { items: [{ post, profile }, ...], cursor }
        const soraFeed = data as SoraFeedResponse as any;
        const mapped = this.normalizeFromSoraFeed(soraFeed);
        videos = mapped.videos;
        total = videos.length;
      } else {
        console.warn('Unexpected response structure:', data);
        throw new Error('Unable to parse feed response');
      }

      return {
        videos,
        total,
        hasMore: data.hasMore !== undefined ? data.hasMore : false,
        page: data.page
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  private normalizeVideoItem(item: any): VideoItem {
    // This method normalizes different possible video item structures
    return {
      id: item.id || item.video_id || item._id || Math.random().toString(36).substr(2, 9),
      title: item.title || item.name || item.video_title || 'Untitled Video',
      description: item.description || item.desc || item.video_description,
      videoUrl: item.videoUrl || item.video_url || item.url || item.src || item.video_src,
      thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || item.thumb_url || item.thumbnail,
      duration: item.duration || item.video_duration,
      createdAt: item.createdAt || item.created_at || item.publish_date,
      updatedAt: item.updatedAt || item.updated_at
    };
  }

  private normalizeFromSoraFeed(feed: SoraFeedResponse): { videos: VideoItem[] } {
    const videos: VideoItem[] = [];
    for (const item of feed.items) {
      const post: SoraPost = (item as any).post;
      if (!post || !Array.isArray(post.attachments)) continue;
      const attachment: SoraAttachment | undefined = post.attachments.find((att: any) => att && att.kind === 'sora');
      if (!attachment) continue;

      const videoUrl = attachment.downloadable_url || attachment.encodings?.source?.path || attachment.url;
      if (!videoUrl) continue;

      const thumbnailUrl = attachment.encodings?.thumbnail?.path || undefined;
      const title = attachment.title || (post.text ? post.text.slice(0, 80) : `Post ${post.id}`);

      videos.push({
        id: post.id,
        title,
        description: post.text,
        videoUrl,
        thumbnailUrl,
        prompt: attachment.prompt || post.text || undefined,
        source: post.source || attachment.source || undefined,
        generationId: attachment.generation_id || undefined,
        createdAt: post.posted_at ? new Date(post.posted_at * 1000).toISOString() : undefined,
        updatedAt: post.updated_at ? new Date(post.updated_at * 1000).toISOString() : undefined
      });
    }
    return { videos };
  }

  async getVideoDetails(videoId: string): Promise<VideoItem> {
    try {
      const response: AxiosResponse = await this.client.get(`/video/${videoId}`);
      return this.normalizeVideoItem(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get video details: ${error.message}`);
      }
      throw error;
    }
  }
}