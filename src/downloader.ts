import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import ProgressBar from 'progress';
import { VideoItem, DownloadOptions } from './types';

export class VideoDownloader {
  private outputDir: string;
  private overwrite: boolean;

  constructor(options: DownloadOptions = {}) {
    this.outputDir = options.outputDir || './downloads';
    this.overwrite = options.overwrite || false;

    // Ensure all directories exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      this.outputDir,
      path.join(this.outputDir, 'videos'),
      path.join(this.outputDir, 'metadata')
    ];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private async retryableRequest<T>(
    requestFn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelayMs: number = 500
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        const isRetriable = error.code === 'ECONNRESET' || 
                           error.code === 'ETIMEDOUT' ||
                           error.code === 'ENETUNREACH' ||
                           error.code === 'EAI_AGAIN' ||
                           error.message?.includes('socket hang up');

        if (attempt < maxAttempts && isRetriable) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retry attempts reached');
  }

  async downloadVideo(video: VideoItem): Promise<string> {
    const fileName = this.sanitizeFileName(video.title);
    const videoPath = path.join(this.outputDir, 'videos', `${fileName}.mp4`);
    const thumbnailPath = path.join(this.outputDir, 'videos', `${fileName}_thumbnail.webp`);

    // Check if video already exists
    if (fs.existsSync(videoPath) && !this.overwrite) {
      console.log(`File already exists: ${videoPath}`);
      return videoPath;
    }

    console.log(`Downloading: ${video.title}`);

    return this.retryableRequest(async (): Promise<string> => {
      const response = await axios({
        method: 'GET',
        url: video.videoUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          'Referer': 'https://sora.chatgpt.com/'
        }
      });

      const totalLength = parseInt(response.headers['content-length'] || '0', 10);

      let progressBar: ProgressBar | null = null;
      let downloadedBytes = 0;
      const startedAt = Date.now();

      if (totalLength > 0) {
        progressBar = new ProgressBar(`[:bar] :percent :downloaded/:total @ :speed ETA :eta`, {
          complete: '=',
          incomplete: ' ',
          width: 40,
          total: totalLength
        });
      }

      const writer = fs.createWriteStream(videoPath);

      response.data.on('data', (chunk: Buffer) => {
        if (progressBar) {
          downloadedBytes += chunk.length;
          const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
          const bytesPerSec = Math.floor(downloadedBytes / elapsedSec);
          progressBar.tick(chunk.length, {
            downloaded: this.formatBytes(downloadedBytes),
            total: this.formatBytes(totalLength),
            speed: this.formatBytes(bytesPerSec) + '/s'
          });
        }
      });

      response.data.pipe(writer);

      return new Promise<string>((resolve, reject) => {
        writer.on('finish', () => {
          // Download thumbnail if available
          const thumbnailPromise = video.thumbnailUrl ? this.downloadThumbnail(video.thumbnailUrl, thumbnailPath) : Promise.resolve('');

          thumbnailPromise.then((actualThumbnailPath) => {
            // Use unified metadata writing
            const writtenMetadataPath = this.writeMetadata(video, videoPath, actualThumbnailPath || undefined);
            
            console.log(`\nDownloaded: ${fileName}.mp4`);
            if (video.thumbnailUrl) {
              console.log(`Thumbnail: ${fileName}_thumbnail.webp`);
            }
            console.log(`Metadata: ${path.basename(writtenMetadataPath)}`);
            resolve(videoPath);
          });
        });

        writer.on('error', (error) => {
          console.error(`Error writing file: ${error.message}`);
          reject(error);
        });

        response.data.on('error', (error: any) => {
          console.error(`Download error: ${error.message}`);
          reject(error);
        });
      });
    }).catch(error => {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to download video: ${error.message}`);
      }
      throw error;
    });
  }

  async downloadMultipleVideos(videos: VideoItem[]): Promise<string[]> {
    const results: string[] = [];

    for (const video of videos) {
      try {
        const filePath = await this.downloadVideo(video);
        results.push(filePath);
      } catch (error) {
        console.error(`Failed to download "${video.title}": ${error}`);
      }
    }

    return results;
  }

  async downloadAllFromFeed(videos: VideoItem[], maxConcurrent: number = 3): Promise<string[]> {
    const results: string[] = [];

    // Process videos in batches
    for (let i = 0; i < videos.length; i += maxConcurrent) {
      const batch = videos.slice(i, i + maxConcurrent);

      const batchPromises = batch.map(async (video) => {
        try {
          return await this.downloadVideo(video);
        } catch (error) {
          console.error(`Failed to download "${video.title}": ${error}`);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((result): result is string => result !== null));
    }

    return results;
  }

  private sanitizeFileName(fileName: string): string {
    // Remove invalid characters from filename
    return fileName
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 200); // Limit length
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
  }

  setOutputDir(dir: string): void {
    this.outputDir = dir;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  setOverwrite(overwrite: boolean): void {
    this.overwrite = overwrite;
  }

  private async downloadThumbnail(thumbnailUrl: string, outputPath: string): Promise<string> {
    return this.retryableRequest(async (): Promise<string> => {
      const response = await axios({
        method: 'GET',
        url: thumbnailUrl,
        responseType: 'stream',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          'Referer': 'https://sora.chatgpt.com/'
        }
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise<string>((resolve, reject) => {
        writer.on('finish', () => resolve(outputPath));
        writer.on('error', reject);
        response.data.on('error', reject);
      });
    }).catch(error => {
      console.warn(`Failed to download thumbnail: ${error}`);
      return '';
    });
  }

  /**
   * Write unified metadata for any video download
   */
  writeMetadata(video: VideoItem, videoPath: string, thumbnailPath?: string): string {
    const fileName = this.sanitizeFileName(video.title);
    const metadataPath = path.join(this.outputDir, 'metadata', `${fileName}_metadata.json`);

    const metadata = {
      id: video.id,
      title: video.title,
      description: video.description,
      prompt: video.prompt,
      video_url: video.videoUrl,
      thumbnail_url: video.thumbnailUrl,
      source: video.source,
      generation_id: video.generationId,
      video_path: videoPath,
      thumbnail_path: thumbnailPath || (video.thumbnailUrl ? path.join(path.dirname(videoPath), `${fileName}_thumbnail.webp`) : undefined),
      downloaded_at: new Date().toISOString()
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    return metadataPath;
  }
}