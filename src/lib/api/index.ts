import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { FeedResponse, VideoItem, SoraFeedResponse, SoraAttachment, SoraPost } from '../../types';
import { log } from '../../logger';
import { API_CONFIG } from '../../config/constants';
import { withRetry } from '../../utils/common/retry';
import { createAPIError } from '../../utils/common/error-handler';
import { BaseService } from '../services/base-service';
import { ValidationUtils } from '../../utils/validation';

export class SoraAPI extends BaseService {
  private client: AxiosInstance;
  private baseURL: string = API_CONFIG.BASE_URL;

  constructor(cookies?: string) {
    super('SoraAPI');

    this.logOperation('constructor', {
      baseURL: this.baseURL,
      hasCookies: !!cookies,
      cookieLength: cookies?.length || 0
    });

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        ...API_CONFIG.HEADERS,
        ...(cookies && { 'Cookie': cookies })
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        log.logRequest(config.method?.toUpperCase() || 'GET', config.url || '', config.headers as Record<string, string>, config.data);
        return config;
      },
      (error) => {
        log.error('Request interceptor error', {}, error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        log.logResponse(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status,
          response.headers as Record<string, string>,
          response.data ? JSON.stringify(response.data).length : 0
        );
        return response;
      },
      (error) => {
        if (axios.isAxiosError(error)) {
        log.logResponse(
          error.config?.method?.toUpperCase() || 'GET',
          error.config?.url || '',
          error.response?.status || 0,
          error.response?.headers as Record<string, string>,
          error.response?.data ? JSON.stringify(error.response.data).length : 0
        );
        }
        return Promise.reject(error);
      }
    );
  }

  async getRawFeed(): Promise<SoraFeedResponse> {
    this.logOperationStart('getRawFeed');

    try {
      const response = await this.executeWithRetry(
        () => this.client.get<SoraFeedResponse>(API_CONFIG.ENDPOINTS.FEED, { timeout: 15000 }),
        'getRawFeed'
      );

      const data = response.data;
      ValidationUtils.validateObject(data, 'feed response', ['items']);

      this.logOperationEnd('getRawFeed', {
        dataSize: JSON.stringify(data).length,
        hasItems: data.items?.length || 0
      });

      return data;
    } catch (error) {
      this.handleServiceError(error, 'getRawFeed');
    }
  }

  async getFeed(): Promise<FeedResponse> {
    this.logOperationStart('getFeed');

    try {
      const data = await this.getRawFeed();

      this.logOperation('getFeed', {
        dataType: typeof data,
        isArray: Array.isArray(data),
        keys: typeof data === 'object' && data !== null ? Object.keys(data) : [],
        hasItems: !!(data?.items)
      });

      // Handle Sora feed response structure
      let videos: VideoItem[] = [];
      let total = 0;
      let structure = 'unknown';

      if (Array.isArray(data)) {
        // Direct array response
        structure = 'direct-array';
        videos = data.map(this.normalizeVideoItem);
        total = videos.length;
        this.logOperation('getFeed', { structure, videoCount: videos.length });
      } else if (data.items && Array.isArray(data.items)) {
        // Sora feed shape: { items: [{ post, profile }, ...], cursor }
        structure = 'sora-feed';
        const soraFeed = data as SoraFeedResponse;
        const mapped = this.normalizeFromSoraFeed(soraFeed);
        videos = mapped.videos;
        total = videos.length;
        this.logOperation('getFeed', {
          structure,
          videoCount: videos.length,
          itemCount: data.items.length,
          postsWithAttachments: data.items.filter((item: any) =>
            item.post?.attachments?.some((att: any) => att.kind === 'sora')
          ).length
        });
      } else {
        this.logOperation('getFeed', {
          error: true,
          data: typeof data === 'object' ? Object.keys(data) : data,
          structure: 'unknown'
        });
        throw new Error('Unable to parse feed response');
      }

      const result: FeedResponse = {
        videos,
        total,
        hasMore: false, // Sora feed doesn't have hasMore/page info
        page: undefined
      };

      this.logOperationEnd('getFeed', {
        structure,
        videoCount: videos.length,
        total,
        hasMore: result.hasMore
      });

      return result;
    } catch (error) {
      this.handleServiceError(error, 'getFeed');
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
    log.startTimer('getVideoDetails');
    try {
      log.debug('Fetching video details', { videoId });

      const response = await withRetry(
        () => this.client.get(`${API_CONFIG.ENDPOINTS.VIDEO}/${videoId}`),
        { operation: 'getVideoDetails' }
      );

      const normalized = this.normalizeVideoItem(response.data);
      log.debug('Video details fetched successfully', {
        videoId,
        title: normalized.title,
        hasVideoUrl: !!normalized.videoUrl,
        hasThumbnail: !!normalized.thumbnailUrl
      });

      log.endTimer('getVideoDetails', { videoId, success: true });
      return normalized;
    } catch (error) {
      log.error('Failed to get video details', { videoId }, error as Error);
      log.endTimer('getVideoDetails', { videoId, success: false });

      if (axios.isAxiosError(error)) {
        throw createAPIError(`Failed to get video details: ${error.message}`, { videoId });
      }
      throw error;
    }
  }
}