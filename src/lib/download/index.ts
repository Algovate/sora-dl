import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { VideoItem, DownloadOptions } from '../../types';
import { log } from '../../logger';
import { APP_CONFIG, FILE_CONFIG } from '../../config/constants';
import { withRetry } from '../../utils/common/retry';
import { FileUtils } from '../../utils/common/file-utils';
import { FormatUtils } from '../../utils/formatting';
import { createFileSystemError, createNetworkError } from '../../utils/common/error-handler';
import { BaseService } from '../services/base-service';
import { ProgressManager, BatchProgressManager } from '../services/progress-manager';
import { ValidationUtils } from '../../utils/validation';

export class VideoDownloader extends BaseService {
  private outputDir: string;
  private overwrite: boolean;

  constructor(options: DownloadOptions = {}) {
    super('VideoDownloader');
    
    this.outputDir = options.outputDir || APP_CONFIG.DEFAULT_OUTPUT_DIR;
    this.overwrite = options.overwrite || false;

    this.logOperation('constructor', {
      outputDir: this.outputDir,
      overwrite: this.overwrite
    });

    // Ensure all directories exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      this.outputDir,
      FileUtils.joinPaths(this.outputDir, FILE_CONFIG.DIRECTORIES.VIDEOS),
      FileUtils.joinPaths(this.outputDir, FILE_CONFIG.DIRECTORIES.METADATA)
    ];
    FileUtils.ensureDirectoriesExist(dirs);
  }

  private async retryableRequest<T>(
    requestFn: () => Promise<T>,
    operation: string = 'request'
  ): Promise<T> {
    return withRetry(requestFn, { 
      operation,
      maxAttempts: APP_CONFIG.MAX_RETRY_ATTEMPTS,
      baseDelayMs: APP_CONFIG.RETRY_BASE_DELAY_MS
    });
  }

  async downloadVideo(video: VideoItem): Promise<string> {
    this.logOperationStart('downloadVideo', { videoId: video.id, title: video.title });
    
    // Validate input
    ValidationUtils.validateRequired(video, 'video');
    ValidationUtils.validateRequired(video.id, 'video.id');
    ValidationUtils.validateRequired(video.title, 'video.title');
    ValidationUtils.validateUrl(video.videoUrl, 'video.videoUrl');

    const fileName = FileUtils.sanitizeFileName(video.title);
    const videoPath = FileUtils.joinPaths(this.outputDir, FILE_CONFIG.DIRECTORIES.VIDEOS, `${fileName}${FILE_CONFIG.EXTENSIONS.VIDEO}`);
    const thumbnailPath = FileUtils.joinPaths(this.outputDir, FILE_CONFIG.DIRECTORIES.VIDEOS, `${fileName}${FILE_CONFIG.EXTENSIONS.THUMBNAIL}`);

    this.logOperation('downloadVideo', {
      fileName,
      videoPath,
      videoUrl: video.videoUrl,
      hasThumbnail: !!video.thumbnailUrl
    });

    // Check if video already exists
    if (FileUtils.fileExists(videoPath) && !this.overwrite) {
      this.logOperationEnd('downloadVideo', { videoId: video.id, skipped: true });
      return videoPath;
    }

    return this.retryableRequest(async (): Promise<string> => {
      const response = await axios({
        method: 'GET',
        url: video.videoUrl,
        responseType: 'stream',
        timeout: APP_CONFIG.REQUEST_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          'Referer': 'https://sora.chatgpt.com/'
        }
      });

      const totalLength = parseInt(response.headers['content-length'] || '0', 10);

      log.debug('Video download response received', {
        videoId: video.id,
        statusCode: response.status,
        contentType: response.headers['content-type'],
        contentLength: totalLength,
        contentLengthFormatted: FormatUtils.formatBytes(totalLength)
      });

      let downloadedBytes = 0;
      const startedAt = Date.now();

      const writer = FileUtils.createWriteStream(videoPath);

      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
        const bytesPerSec = Math.floor(downloadedBytes / elapsedSec);
        
        this.logOperation('downloadProgress', {
          videoId: video.id,
          downloaded: FormatUtils.formatBytes(downloadedBytes),
          total: FormatUtils.formatBytes(totalLength),
          speed: FormatUtils.formatSpeed(bytesPerSec),
          percent: totalLength > 0 ? Math.round((downloadedBytes / totalLength) * 100) : 0
        });
      });

      response.data.pipe(writer);

      return new Promise<string>((resolve, reject) => {
        writer.on('finish', () => {
          const downloadDuration = Date.now() - startedAt;
          const avgSpeed = downloadedBytes > 0 ? downloadedBytes / (downloadDuration / 1000) : 0;
          
          log.debug('Video download completed', {
            videoId: video.id,
            fileName,
            downloadedBytes,
            totalLength,
            duration: downloadDuration,
            avgSpeed: FormatUtils.formatSpeed(avgSpeed)
          });

          // Download thumbnail if available
          const thumbnailPromise = video.thumbnailUrl ? this.downloadThumbnail(video.thumbnailUrl, thumbnailPath) : Promise.resolve('');

          thumbnailPromise.then((actualThumbnailPath) => {
            // Use unified metadata writing
            const writtenMetadataPath = this.writeMetadata(video, videoPath, actualThumbnailPath || undefined);

            log.info('Video download and processing completed', {
              videoId: video.id,
              fileName,
              videoPath,
              thumbnailPath: actualThumbnailPath,
              metadataPath: writtenMetadataPath
            });

            console.log(`\nDownloaded: ${fileName}.mp4`);
            if (video.thumbnailUrl) {
              console.log(`Thumbnail: ${fileName}_thumbnail.webp`);
            }
            console.log(`Metadata: ${path.basename(writtenMetadataPath)}`);

            log.endTimer('downloadVideo', {
              videoId: video.id,
              fileName,
              success: true,
              downloadedBytes,
              duration: downloadDuration
            });
            resolve(videoPath);
          }).catch(thumbnailError => {
            log.warn('Thumbnail download failed, continuing with video', {
              videoId: video.id,
              thumbnailError: (thumbnailError as Error).message
            });

            const writtenMetadataPath = this.writeMetadata(video, videoPath);
            log.endTimer('downloadVideo', {
              videoId: video.id,
              fileName,
              success: true,
              downloadedBytes,
              duration: downloadDuration,
              thumbnailFailed: true
            });
            resolve(videoPath);
          });
        });

        writer.on('error', (error) => {
          log.error('Error writing video file', { videoId: video.id, fileName, videoPath }, error);
          log.endTimer('downloadVideo', { videoId: video.id, success: false });
          reject(error);
        });

        response.data.on('error', (error: any) => {
          log.error('Error during video download stream', { videoId: video.id, fileName }, error);
          log.endTimer('downloadVideo', { videoId: video.id, success: false });
          reject(error);
        });
      });
    }, `downloadVideo-${video.id}`).catch(error => {
      log.error('Video download failed after retries', { videoId: video.id, fileName }, error);
      log.endTimer('downloadVideo', { videoId: video.id, success: false });

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
    this.logOperationStart('downloadAllFromFeed', { 
      videoCount: videos.length, 
      maxConcurrent 
    });

    // Validate input
    ValidationUtils.validateArray(videos, 'videos', 1);
    ValidationUtils.validatePositiveInteger(maxConcurrent, 'maxConcurrent');

    const batchProgress = new BatchProgressManager('downloadAllFromFeed');
    const progress = batchProgress.createProgress('main', {
      total: videos.length,
      title: 'Downloading videos',
      showProgress: true
    });

    const results: string[] = [];
    let successCount = 0;
    let failureCount = 0;
    const totalBatches = Math.ceil(videos.length / maxConcurrent);

    // Process videos in batches
    for (let i = 0; i < videos.length; i += maxConcurrent) {
      const batch = videos.slice(i, i + maxConcurrent);
      const batchIndex = Math.floor(i / maxConcurrent);

      log.debug('Processing batch', {
        batchIndex: batchIndex + 1,
        totalBatches,
        batchSize: batch.length,
        videoIds: batch.map(v => v.id)
      });

      const batchPromises = batch.map(async (video) => {
        try {
          const result = await this.downloadVideo(video);
          successCount++;
          progress.update(1, `Downloaded: ${video.title}`);
          return result;
        } catch (error) {
          failureCount++;
          progress.update(1, `Failed: ${video.title}`);
          this.logOperation('downloadVideo', {
            error: true,
            videoId: video.id,
            title: video.title,
            errorMessage: (error as Error).message
          });
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const batchSuccesses = batchResults.filter((result): result is string => result !== null);
      results.push(...batchSuccesses);

      this.logOperation('batchComplete', {
        batchIndex: batchIndex + 1,
        totalBatches,
        batchSuccesses: batchSuccesses.length,
        batchFailures: batch.length - batchSuccesses.length
      });
    }

    progress.complete(`Completed: ${successCount}/${videos.length} videos downloaded`);
    batchProgress.completeAll();

    this.logOperationEnd('downloadAllFromFeed', {
      totalVideos: videos.length,
      successCount,
      failureCount,
      successRate: `${((successCount / videos.length) * 100).toFixed(1)}%`
    });

    return results;
  }


  setOutputDir(dir: string): void {
    this.outputDir = dir;
    FileUtils.ensureDirectoryExists(this.outputDir);
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
        timeout: APP_CONFIG.THUMBNAIL_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          'Referer': 'https://sora.chatgpt.com/'
        }
      });

      const writer = FileUtils.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise<string>((resolve, reject) => {
        writer.on('finish', () => resolve(outputPath));
        writer.on('error', reject);
        response.data.on('error', reject);
      });
    }, 'downloadThumbnail').catch(error => {
      console.warn(`Failed to download thumbnail: ${error}`);
      return '';
    });
  }

  /**
   * Write unified metadata for any video download
   */
  writeMetadata(video: VideoItem, videoPath: string, thumbnailPath?: string): string {
    const fileName = FileUtils.sanitizeFileName(video.title);
    const metadataPath = FileUtils.joinPaths(this.outputDir, FILE_CONFIG.DIRECTORIES.METADATA, `${fileName}${FILE_CONFIG.EXTENSIONS.METADATA}`);

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
      thumbnail_path: thumbnailPath || (video.thumbnailUrl ? FileUtils.joinPaths(FileUtils.getDirectoryName(videoPath), `${fileName}${FILE_CONFIG.EXTENSIONS.THUMBNAIL}`) : undefined),
      downloaded_at: new Date().toISOString()
    };

    FileUtils.writeJSONFile(metadataPath, metadata);
    return metadataPath;
  }
}