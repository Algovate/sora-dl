#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SoraVideoDownloader } from './index';
import { LocalFeedProcessor } from './local-feed-processor';
import { CookieManager } from './cookie-manager';

// Common CLI helper interfaces and functions
interface DownloadContext {
  outputDir: string;
  overwrite: boolean;
  concurrent: number;
  verbose: boolean;
}

function printDownloadHeader(context: DownloadContext, extraInfo?: Record<string, string>) {
  console.log(`📁 Output directory: ${path.resolve(context.outputDir)}`);
  console.log(`🔄 Concurrent downloads: ${context.concurrent}`);
  if (extraInfo) {
    Object.entries(extraInfo).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
  }
  if (context.overwrite) console.log('⚠️  Overwrite mode enabled');
}

function printDownloadSummary(fileCount: number, duration: number, outputDir: string) {
  console.log(`\n✅ Download completed successfully!`);
  console.log(`📊 Summary:`);
  console.log(`   • Files downloaded: ${fileCount}`);
  console.log(`   • Time taken: ${duration}s`);
  console.log(`   • Location: ${path.resolve(outputDir)}`);
  console.log(`   • Videos: ${path.resolve(outputDir, 'videos')}`);
  console.log(`   • Metadata: ${path.resolve(outputDir, 'metadata')}`);
}

function handleDownloadError(error: unknown, context: string) {
  console.error(`❌ Error ${context}:`, error);
  process.exit(1);
}

const ERROR_MESSAGES = {
  FILE_NOT_FOUND: (path: string) => `❌ Error: File not found: ${path}`,
  DOWNLOAD_FAILED: (context: string) => `❌ Error downloading ${context}`,
  PROCESSING_FAILED: (context: string) => `❌ Error processing ${context}`,
  URL_REQUIRED: () => `❌ Error: Video URL is required`,
  FEED_NOT_FOUND: (path: string) => `❌ Error: Feed file not found: ${path}`
};

const program = new Command();

program
  .name('sora-dl')
  .description('A TypeScript video downloader for Sora feed')
  .version('1.0.0');

program
  .command('feed')
  .description('List videos from the remote Sora feed')
  .option('-c, --cookies <cookies>', 'Cookies string for authentication')
  .option('-o, --output <file>', 'Output file to save the normalized list (optional)')
  .option('--raw <file>', 'Also save raw feed JSON to a file (usable with download local)')
  .action(async (options) => {
    try {
      const downloader = new SoraVideoDownloader(options.cookies);
      console.log('Fetching video feed...');
      const feed = await downloader.getFeed();

      console.log(`Found ${feed.total} videos:`);
      feed.videos.forEach((video, index) => {
        console.log(`${index + 1}. ${video.title}`);
        if (video.description) {
          console.log(`   Description: ${video.description.substring(0, 100)}...`);
        }
        console.log(`   URL: ${video.videoUrl}`);
        console.log('');
      });

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(feed, null, 2));
        console.log(`Normalized feed saved to: ${options.output}`);
      }

      if (options.raw) {
        const { SoraAPI } = require('./api');
        const api = new SoraAPI(options.cookies);
        const rawData = await api.getRawFeed();
        fs.writeFileSync(options.raw, JSON.stringify(rawData, null, 2));
        console.log(`Raw feed saved to: ${options.raw}`);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
      process.exit(1);
    }
  });

const downloadCmd = program
  .command('download')
  .description('Download videos from various sources');

// Download from remote feed
downloadCmd
  .command('feed')
  .description('Download videos from the remote Sora feed')
  .option('-c, --cookies <cookies>', 'Cookies string for authentication')
  .option('-o, --output-dir <dir>', 'Output directory for downloaded videos', './downloads')
  .option('-n, --count <number>', 'Number of recent videos to download', '10')
  .option('--all', 'Download all videos from the feed')
  .option('--overwrite', 'Overwrite existing files')
  .option('--concurrent <number>', 'Maximum concurrent downloads', '3')
  .option('--verbose', 'Show detailed progress information', false)
  .action(async (options) => {
    try {
      const downloader = new SoraVideoDownloader(options.cookies, {
        outputDir: options.outputDir,
        overwrite: options.overwrite
      });

      const context: DownloadContext = {
        outputDir: options.outputDir,
        overwrite: options.overwrite,
        concurrent: parseInt(options.concurrent),
        verbose: options.verbose
      };

      printDownloadHeader(context);

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
      printDownloadSummary(downloadedFiles.length, parseFloat(duration), context.outputDir);

    } catch (error) {
      handleDownloadError(error, 'downloading videos');
    }
  });

// Download a single video by URL
downloadCmd
  .command('url')
  .description('Download a specific video URL')
  .option('-u, --url <url>', 'Video URL to download')
  .option('-t, --title <title>', 'Video title for filename')
  .option('-o, --output-dir <dir>', 'Output directory for downloaded video', './downloads')
  .option('--overwrite', 'Overwrite existing files')
  .option('--verbose', 'Show detailed progress information', false)
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
        verbose: options.verbose
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
      handleDownloadError(error, 'downloading video');
    }
  });

// Download from local feed file
downloadCmd
  .command('local')
  .description('Download videos from a local feed.json file')
  .argument('<feed-file>', 'Path to the local feed.json file')
  .option('-o, --output-dir <dir>', 'Output directory for downloaded videos and metadata', './downloads')
  .option('-n, --count <number>', 'Number of recent videos to download', '10')
  .option('--all', 'Download all videos from the feed')
  .option('--list', 'List posts in the feed without downloading')
  .option('--overwrite', 'Overwrite existing files')
  .option('--concurrent <number>', 'Maximum concurrent downloads', '3')
  .option('--verbose', 'Show detailed progress information', false)
  .action(async (feedFile, options) => {
    try {
      if (!fs.existsSync(feedFile)) {
        console.error(ERROR_MESSAGES.FEED_NOT_FOUND(feedFile));
        process.exit(1);
      }

      const processor = new LocalFeedProcessor(feedFile, options.outputDir);
      const context: DownloadContext = {
        outputDir: options.outputDir,
        overwrite: options.overwrite,
        concurrent: parseInt(options.concurrent),
        verbose: options.verbose
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
      handleDownloadError(error, 'processing local feed');
    }
  });

const cookiesCmd = program
  .command('cookies')
  .description('Manage cookies for authenticated access');

// Extract cookies using browser automation
cookiesCmd
  .command('extract')
  .description('Extract cookies automatically using browser automation')
  .option('--headless', 'Run browser in headless mode (no GUI)', false)
  .option('--save', 'Save extracted cookies to config file', false)
  .action(async (options) => {
    try {
      const cookieManager = new CookieManager();

      console.log('🍪 Extracting cookies automatically...');
      const cookies = await cookieManager.extractWithPuppeteer(!options.headless);

      console.log('\n✅ Cookie extraction successful!');
      console.log('\n📝 Your cookies:');
      console.log(cookies.substring(0, 100) + '...');

      if (options.save) {
        await cookieManager.saveCookies(cookies, 'puppeteer-auto-extract');
        console.log('\n💾 Cookies saved to config file for future use.');
      } else {
        console.log('\n💡 Use these cookies with: -c "' + cookies + '"');
        console.log('💡 Or save them with: sora-dl cookies extract --save');
      }

    } catch (error) {
      console.error('❌ Failed to extract cookies:', error);
      process.exit(1);
    }
  });

// Import cookies from browser
cookiesCmd
  .command('import')
  .description('Import cookies from browser cookie files')
  .argument('[browser]', 'Browser name (chrome, firefox, safari, edge)')
  .option('--list', 'List available browsers instead of importing')
  .option('--save', 'Save imported cookies to config file', false)
  .action(async (browser, options) => {
    try {
      const cookieManager = new CookieManager();

      if (options.list) {
        const availableBrowsers = cookieManager.listAvailableBrowsers();

        if (availableBrowsers.length === 0) {
          console.log('❌ No browsers found with accessible cookie files.');
          console.log('💡 Make sure your browser is closed and try again.');
          return;
        }

        console.log('🌐 Available browsers for cookie import:');
        availableBrowsers.forEach(browser => {
          console.log(`  • ${browser.name} (${browser.platform})`);
        });

        console.log('\n💡 Use: sora-dl cookies import <browser-name>');
        return;
      }

      if (!browser) {
        console.error('❌ Browser name is required. Use --list to see available browsers.');
        process.exit(1);
      }

      console.log(`🍪 Importing cookies from ${browser}...`);
      const cookies = await cookieManager.importFromBrowser(browser);

      console.log('\n✅ Cookie import successful!');
      console.log('\n📝 Your cookies:');
      console.log(cookies.substring(0, 100) + '...');

      if (options.save) {
        await cookieManager.saveCookies(cookies, `${browser}-import`);
        console.log('\n💾 Cookies saved to config file for future use.');
      } else {
        console.log('\n💡 Use these cookies with: -c "' + cookies + '"');
        console.log('💡 Or save them with: sora-dl cookies import ' + browser + ' --save');
      }

    } catch (error) {
      console.error('❌ Failed to import cookies:', error);
      process.exit(1);
    }
  });

// Save cookies manually
cookiesCmd
  .command('save')
  .description('Save cookies to config file for future use')
  .argument('<cookies>', 'Cookie string to save')
  .option('--source <source>', 'Source description (default: manual)', 'manual')
  .action(async (cookies, options) => {
    try {
      const cookieManager = new CookieManager();

      console.log('💾 Saving cookies to config file...');
      await cookieManager.saveCookies(cookies, options.source);

      console.log('✅ Cookies saved successfully!');
      console.log('💡 They will be used automatically in future commands when no -c option is provided.');

    } catch (error) {
      console.error('❌ Failed to save cookies:', error);
      process.exit(1);
    }
  });

// Validate cookies
cookiesCmd
  .command('validate')
  .description('Validate if cookies are working')
  .option('-c, --cookies <cookies>', 'Cookie string to validate (uses saved cookies if not provided)')
  .action(async (options) => {
    try {
      const cookieManager = new CookieManager();
      const cookies = options.cookies || cookieManager.loadCookies();

      if (!cookies) {
        console.log('❌ No cookies provided or saved.');
        console.log('💡 Use -c to provide cookies or save them first with: sora-dl cookies save <cookies>');
        process.exit(1);
      }

      console.log('🔍 Validating cookies...');
      const isValid = await cookieManager.validateCookies(cookies);

      if (isValid) {
        console.log('✅ Cookies are valid and working!');
      } else {
        console.log('❌ Cookies are invalid or expired.');
        console.log('💡 Try extracting new cookies with: sora-dl cookies extract');
      }

    } catch (error) {
      console.error('❌ Failed to validate cookies:', error);
      process.exit(1);
    }
  });

// Show help (default action when no subcommand)
cookiesCmd
  .action(() => {
    console.log(`
🍪 EASY WAYS TO GET COOKIES:

🚀 METHOD 1: Automatic Extraction (Recommended)
   sora-dl cookies extract --save

📁 METHOD 2: Import from Browser
   sora-dl cookies import --list          # See available browsers
   sora-dl cookies import chrome --save   # Import from Chrome

🔧 METHOD 3: Manual Method (Advanced)
   1. Open browser and go to https://sora.chatgpt.com/
   2. Open Developer Tools (F12 or Cmd+Opt+I)
   3. Go to Network tab
   4. Refresh page or navigate to see video feed
   5. Find request to 'backend/public/nf2/feed'
   6. Copy entire Cookie header value
   7. Save them: sora-dl cookies save "cookie1=value1; cookie2=value2"

✅ VALIDATE COOKIES:
   sora-dl cookies validate

📋 USAGE EXAMPLES:
   sora-dl feed                    # Uses saved cookies
   sora-dl download feed -n 5      # Uses saved cookies
   sora-dl feed -c "manual=cookies" # Use manual cookies

💡 TIP: Save cookies once with --save flag, then they're used automatically!
    `);
  });

// Show saved cookies file location and values
cookiesCmd
  .command('show')
  .description('Show cookies file location and current saved cookie values')
  .option('--raw', 'Print full raw cookie string (warning: sensitive)', false)
  .action(() => {
    const cookieManager = new CookieManager();
    const configPath = cookieManager.getConfigPath();
    const info = cookieManager.getSavedCookiesInfo();

    console.log(`Config file: ${configPath}`);
    if (!info) {
      console.log('No cookies found in config.');
      return;
    }

    if (process.argv.includes('--raw')) {
      console.log('Cookies (raw):');
      console.log(info.string);
    } else {
      const preview = info.string.length > 120 ? info.string.slice(0, 120) + '...' : info.string;
      console.log('Cookies (preview):');
      console.log(preview);
    }
    if (info.source) console.log(`Source: ${info.source}`);
    if (info.savedAt) console.log(`Saved at: ${info.savedAt}`);
  });

program.parse();