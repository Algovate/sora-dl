// Application constants and configuration
export const APP_CONFIG = {
  NAME: 'sora-dl',
  VERSION: process.env.PACKAGE_VERSION || '1.2.1',
  DESCRIPTION: 'A TypeScript video downloader for Sora feed',
  DEFAULT_OUTPUT_DIR: './downloads',
  DEFAULT_CONCURRENT_DOWNLOADS: 3,
  DEFAULT_DOWNLOAD_COUNT: 10,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 500,
  REQUEST_TIMEOUT_MS: 30000,
  THUMBNAIL_TIMEOUT_MS: 15000,
  LOG_CLEANUP_DAYS: 7
} as const;

export const API_CONFIG = {
  BASE_URL: 'https://sora.chatgpt.com/backend/public/nf2',
  ENDPOINTS: {
    FEED: '/feed',
    VIDEO: '/video'
  },
  HEADERS: {
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
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  }
} as const;

export const FILE_CONFIG = {
  EXTENSIONS: {
    VIDEO: '.mp4',
    THUMBNAIL: '_thumbnail.webp',
    METADATA: '_metadata.json'
  },
  DIRECTORIES: {
    VIDEOS: 'videos',
    METADATA: 'metadata',
    LOGS: 'logs'
  },
  MAX_FILENAME_LENGTH: 200
} as const;

export const ERROR_MESSAGES = {
  FILE_NOT_FOUND: (path: string) => `❌ Error: File not found: ${path}`,
  DOWNLOAD_FAILED: (context: string) => `❌ Error downloading ${context}`,
  PROCESSING_FAILED: (context: string) => `❌ Error processing ${context}`,
  URL_REQUIRED: () => `❌ Error: Video URL is required`,
  FEED_NOT_FOUND: (path: string) => `❌ Error: Feed file not found: ${path}`,
  API_REQUEST_FAILED: (message: string) => `API request failed: ${message}`,
  MAX_RETRY_ATTEMPTS: () => 'Max retry attempts reached'
} as const;

export const SUCCESS_MESSAGES = {
  DOWNLOAD_COMPLETED: (fileCount: number, duration: number, outputDir: string) => 
    `\n✅ Download completed successfully!\n📊 Summary:\n   • Files downloaded: ${fileCount}\n   • Time taken: ${duration}s\n   • Location: ${outputDir}`,
} as const;

