import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SoraVideoDownloader } from '../../index';
import { LocalFeedProcessor } from '../../local-feed-processor';
import { log } from '../../logger';
import { handleError, createValidationError } from '../../utils/error-handler';
import { ERROR_MESSAGES } from '../../config/constants';
import { setupLogging } from '../logging-setup';
import { addDownloadFeedOptions, addDownloadUrlOptions, addDownloadLocalOptions } from '../common-options';

export interface DownloadContext {
  outputDir: string;
  overwrite: boolean;
  concurrent: number;
  verbose: boolean;
  debug: boolean;
  logToFile: boolean;
  logLevel: string;
}

export function printDownloadHeader(context: DownloadContext, extraInfo?: Record<string, string>) {
  console.log(`📁 Output directory: ${path.resolve(context.outputDir)}`);
  console.log(`🔄 Concurrent downloads: ${context.concurrent}`);
  if (context.debug || context.verbose) {
    console.log(`🔧 Debug mode enabled`);
  }
  if (extraInfo) {
    Object.entries(extraInfo).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
  }
  if (context.overwrite) console.log('⚠️  Overwrite mode enabled');
}

export function printDownloadSummary(fileCount: number, duration: number, outputDir: string) {
  console.log(`\n✅ Download completed successfully!`);
  console.log(`📊 Summary:`);
  console.log(`   • Files downloaded: ${fileCount}`);
  console.log(`   • Time taken: ${duration}s`);
  console.log(`   • Location: ${path.resolve(outputDir)}`);
  console.log(`   • Videos: ${path.resolve(outputDir, 'videos')}`);
  console.log(`   • Metadata: ${path.resolve(outputDir, 'metadata')}`);
}

export function createDownloadFeedCommand(): Command {
  const command = new Command('feed')
    .description('Download videos from the remote Sora feed');
  
  addDownloadFeedOptions(command)
    .action(async (options) => {
      try {
        const context: DownloadContext = {
          outputDir: options.outputDir,
          overwrite: options.overwrite,
          concurrent: parseInt(options.concurrent),
          verbose: options.verbose,
          debug: options.debug,
          logToFile: options.logToFile,
          logLevel: options.logLevel
        };

        printDownloadHeader(context);

        const downloader = new SoraVideoDownloader(options.cookies, {
          outputDir: options.outputDir,
          overwrite: options.overwrite
        });

        let downloadedFiles: string[] = [];
        const startTime = Date.now();

        if (options.all) {
          console.log('📥 Downloading all videos from remote feed...');
          downloadedFiles = await downloader.downloadAllVideos(context.concurrent);
        } else {
          console.log(`📥 Downloading ${parseInt(options.count)} most recent videos from remote feed...`);
          downloadedFiles = await downloader.downloadRecentVideos(parseInt(options.count), context.concurrent);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        if (downloadedFiles.length === 0) {
          console.log('\n⚠️  No videos were downloaded. This could be because:');
          console.log('   • No cookies provided (use --cookies option)');
          console.log('   • Network connection issues');
          console.log('   • No videos available in the feed');
          console.log('\n💡 Try providing authentication cookies:');
          console.log('   sora-dl download feed --cookies "your-cookie-string"');
        } else {
          printDownloadSummary(downloadedFiles.length, parseFloat(duration), context.outputDir);
        }

      } catch (error) {
        handleError(error, 'downloading videos');
      }
    });

  return command;
}

export function createDownloadUrlCommand(): Command {
  const command = new Command('url')
    .description('Download a specific video URL');
  
  addDownloadUrlOptions(command)
    .action(async (options) => {
      try {

        if (!options.url) {
          console.error(ERROR_MESSAGES.URL_REQUIRED());
          console.log('💡 Use: sora-dl download url --url "https://example.com/video.mp4"');
          process.exit(1);
        }

        const downloader = new SoraVideoDownloader(undefined, {
          outputDir: options.outputDir,
          overwrite: options.overwrite
        });

        const video = {
          id: Date.now().toString(),
          title: options.title || 'downloaded_video',
          videoUrl: options.url,
          source: 'manual-url',
          generationId: undefined
        };

        const context: DownloadContext = {
          outputDir: options.outputDir,
          overwrite: options.overwrite,
          concurrent: 1,
          verbose: false,
          debug: false,
          logToFile: false,
          logLevel: 'info'
        };

        printDownloadHeader(context, {
          '📥 Downloading video': video.title,
          '🔗 URL': options.url
        });

        const startTime = Date.now();
        const filePath = await downloader.downloadVideo(video);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        printDownloadSummary(1, parseFloat(duration), context.outputDir);

      } catch (error) {
        handleError(error, 'downloading video');
      }
    });

  return command;
}

export function createDownloadLocalCommand(): Command {
  const command = new Command('local')
    .description('Download videos from a local feed.json file');
  
  addDownloadLocalOptions(command)
    .action(async (feedFile, options) => {
      try {
        // Setup logging if debug options are explicitly provided
        if (options.debug || options.logToFile || (options.logLevel && options.logLevel !== 'info')) {
          setupLogging({
            debug: options.debug,
            logToFile: options.logToFile,
            logLevel: options.logLevel,
            verbose: options.verbose
          });
        }

        if (!fs.existsSync(feedFile)) {
          console.error(ERROR_MESSAGES.FEED_NOT_FOUND(feedFile));
          process.exit(1);
        }

        const processor = new LocalFeedProcessor(feedFile, options.outputDir);
        const context: DownloadContext = {
          outputDir: options.outputDir,
          overwrite: options.overwrite,
          concurrent: parseInt(options.concurrent),
          verbose: options.verbose,
          debug: false,
          logToFile: false,
          logLevel: 'info'
        };

        printDownloadHeader(context, {
          '📄 Feed file': path.resolve(feedFile)
        });

        if (options.list) {
          console.log('📋 Listing posts in feed...');
          processor.listPosts();
          return;
        }

        let processedMetadata: any[] = [];
        const startTime = Date.now();

        if (options.all) {
          console.log('📥 Processing all posts in local feed...');
          processedMetadata = await processor.processAllPosts(context.concurrent);
        } else {
          console.log(`📥 Processing ${parseInt(options.count)} most recent posts in local feed...`);
          processedMetadata = await processor.processRecentPosts(parseInt(options.count), context.concurrent);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        printDownloadSummary(processedMetadata.length, parseFloat(duration), context.outputDir);

      } catch (error) {
        handleError(error, 'processing local feed');
      }
    });

  return command;
}
