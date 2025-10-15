import { SoraAPI } from './api';
import { VideoDownloader } from './downloader';
import { CookieManager } from './cookie-manager';
import { VideoItem, DownloadOptions } from './types';

export class SoraVideoDownloader {
  private api: SoraAPI;
  private downloader: VideoDownloader;
  private cookieManager: CookieManager;

  constructor(cookies?: string, downloadOptions?: DownloadOptions) {
    this.cookieManager = new CookieManager();

    // Use provided cookies, or try to load saved cookies
    const finalCookies = cookies || this.cookieManager.loadCookies();

    if (!cookies && finalCookies) {
      console.log('🍪 Using saved cookies from config file');
    } else if (!cookies && !finalCookies) {
      console.log('⚠️  No cookies provided. Run "sora-dl cookies" for help getting cookies.');
    }

    this.api = new SoraAPI(finalCookies || undefined);
    this.downloader = new VideoDownloader(downloadOptions);
  }

  async getFeed() {
    return await this.api.getFeed();
  }

  async downloadVideo(video: VideoItem): Promise<string> {
    return await this.downloader.downloadVideo(video);
  }

  async downloadAllVideos(maxConcurrent: number = 3): Promise<string[]> {
    const feed = await this.getFeed();
    return await this.downloader.downloadAllFromFeed(feed.videos, maxConcurrent);
  }

  async downloadRecentVideos(count: number = 10, maxConcurrent: number = 3): Promise<string[]> {
    const feed = await this.getFeed();
    const videosToDownload = feed.videos.slice(0, count);
    return await this.downloader.downloadAllFromFeed(videosToDownload, maxConcurrent);
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