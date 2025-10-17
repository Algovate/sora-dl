import { SoraAPI } from './api';
import { VideoDownloader } from './downloader';
import { VideoItem, DownloadOptions } from './types';
import { log } from './logger';
import { BaseService } from './core/base-service';
import { ConfigManager } from './core/config-manager';
import { ValidationUtils } from './utils/validation';

export class SoraVideoDownloader extends BaseService {
  private api: SoraAPI;
  private downloader: VideoDownloader;
  private configManager: ConfigManager;

  constructor(cookies?: string, downloadOptions?: DownloadOptions) {
    super('SoraVideoDownloader');
    
    this.configManager = ConfigManager.getInstance();
    
    this.logOperation('constructor', {
      hasProvidedCookies: !!cookies,
      downloadOptions
    });

    // Use provided cookies directly
    if (!cookies) {
      console.log('⚠️  No cookies provided. API calls may fail without authentication.');
      log.warn('No cookies available - API calls may fail');
    } else {
      log.debug('Using provided cookies', { cookieLength: cookies.length });
    }

    this.api = new SoraAPI(cookies);
    this.downloader = new VideoDownloader(downloadOptions);

    log.info('SoraVideoDownloader initialized successfully');
  }

  async getFeed() {
    this.logOperationStart('getFeed');
    
    try {
      const feed = await this.api.getFeed();
      
      this.logOperationEnd('getFeed', {
        videoCount: feed.videos.length,
        total: feed.total,
        hasMore: feed.hasMore
      });
      
      return feed;
    } catch (error) {
      this.handleServiceError(error, 'getFeed');
    }
  }

  async downloadVideo(video: VideoItem): Promise<string> {
    this.logOperationStart('downloadVideo', { videoId: video.id, title: video.title });
    
    // Validate input
    ValidationUtils.validateRequired(video, 'video');
    ValidationUtils.isVideoItem(video) || ValidationUtils.validateRequired(null, 'valid video item');
    
    try {
      const result = await this.downloader.downloadVideo(video);
      
      this.logOperationEnd('downloadVideo', { 
        videoId: video.id, 
        resultPath: result 
      });
      
      return result;
    } catch (error) {
      this.handleServiceError(error, 'downloadVideo');
    }
  }

  async downloadAllVideos(maxConcurrent: number = 3): Promise<string[]> {
    log.info('Starting download of all videos', { maxConcurrent });
    const feed = await this.getFeed();
    const result = await this.downloader.downloadAllFromFeed(feed.videos, maxConcurrent);
    log.info('All videos download completed', {
      requested: feed.videos.length,
      downloaded: result.length,
      successRate: `${((result.length / feed.videos.length) * 100).toFixed(1)}%`
    });
    return result;
  }

  async downloadRecentVideos(count: number = 10, maxConcurrent: number = 3): Promise<string[]> {
    log.info('Starting download of recent videos', { count, maxConcurrent });
    const feed = await this.getFeed();
    const videosToDownload = feed.videos.slice(0, count);
    
    if (videosToDownload.length === 0) {
      log.warn('No videos available to download from feed');
      return [];
    }
    
    const result = await this.downloader.downloadAllFromFeed(videosToDownload, maxConcurrent);
    log.info('Recent videos download completed', {
      requested: videosToDownload.length,
      downloaded: result.length,
      successRate: `${((result.length / videosToDownload.length) * 100).toFixed(1)}%`
    });
    return result;
  }

  setOutputDir(dir: string): void {
    this.downloader.setOutputDir(dir);
  }

  setOverwrite(overwrite: boolean): void {
    this.downloader.setOverwrite(overwrite);
  }
}

export { SoraAPI, VideoDownloader };
export * from './types';