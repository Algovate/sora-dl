import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { SoraFeedResponse, SoraPost, VideoMetadata, VideoItem } from '../../types';
import { VideoDownloader } from '../download';

export class LocalFeedProcessor {
  private feedData: SoraFeedResponse;
  private outputDir: string;
  private downloader: VideoDownloader;

  constructor(feedJsonPath: string, outputDir: string = './downloads') {
    this.outputDir = outputDir;
    this.downloader = new VideoDownloader({ outputDir });

    // Load and parse the feed JSON
    if (!fs.existsSync(feedJsonPath)) {
      throw new Error(`Feed file not found: ${feedJsonPath}`);
    }

    const feedContent = fs.readFileSync(feedJsonPath, 'utf8');
    this.feedData = this.parsePossiblyDirtyJson(feedContent, feedJsonPath);
  }

  private parsePossiblyDirtyJson(content: string, filePath: string): SoraFeedResponse {
    try {
      return JSON.parse(content);
    } catch (firstError) {
      // Attempt to sanitize common issues in large scraped JSON files:
      // 1) Control characters inside string literals must be escaped
      // 2) Other control chars and non-breaking spaces outside strings can be normalized
      const sanitized = this.escapeControlCharsInsideStrings(
        content
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
          .replace(/\u00A0/g, ' ')
      );

      try {
        return JSON.parse(sanitized);
      } catch (secondError) {
        const hint = `Failed to parse JSON file: ${filePath}. ` +
          `Ensure it is valid JSON. Consider re-exporting the feed or ` +
          `pre-cleaning it (e.g. remove control characters).`;
        // Re-throw with additional context while preserving original error message
        const err = new SyntaxError(`${hint} Original error: ${(secondError as Error).message}`);
        throw err;
      }
    }
  }

  // Escapes control characters found within JSON string literals to their \n/\r/\t or \u00XX forms
  private escapeControlCharsInsideStrings(input: string): string {
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (!inString) {
        if (ch === '"') {
          inString = true;
        }
        result += ch;
        continue;
      }

      // inString === true
      if (escape) {
        // Previous char was a backslash, keep as-is and clear escape state
        result += ch;
        escape = false;
        // If this character closes the string, it's already escaped so fine
        continue;
      }

      if (ch === '\\') {
        escape = true;
        result += ch;
        continue;
      }

      if (ch === '"') {
        inString = false;
        result += ch;
        continue;
      }

      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        // Control chars must be escaped in JSON strings
        if (ch === '\n') {
          result += '\\n';
        } else if (ch === '\r') {
          result += '\\r';
        } else if (ch === '\t') {
          result += '\\t';
        } else {
          result += '\\u' + code.toString(16).padStart(4, '0');
        }
      } else {
        result += ch;
      }
    }

    return result;
  }


  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 200); // Limit length
  }

  private extractMetadata(post: SoraPost): VideoMetadata {
    const attachment = post.attachments.find(att => att.kind === 'sora');

    if (!attachment) {
      throw new Error(`No Sora attachment found for post ${post.id}`);
    }

    return {
      id: post.id,
      shared_by: post.shared_by,
      posted_at: post.posted_at,
      updated_at: post.updated_at,
      text: post.text,
      permalink: `https://sora.chatgpt.com/post/${post.id}`,
      video_url: attachment.downloadable_url,
      thumbnail_url: attachment.encodings.thumbnail.path,
      width: attachment.width,
      height: attachment.height,
      generation_id: attachment.generation_id
    };
  }

  private async downloadVideo(metadata: VideoMetadata): Promise<string> {
    const filename = `${metadata.id}_${metadata.generation_id}.mp4`;
    const videoPath = path.join(this.outputDir, 'videos', filename);

    if (fs.existsSync(videoPath)) {
      console.log(`Video already exists: ${filename}`);
      return videoPath;
    }

    console.log(`Downloading video: ${metadata.id}`);

    try {
      const response = await axios({
        method: 'GET',
        url: metadata.video_url,
        responseType: 'stream',
        timeout: 30000
      });

      const writer = fs.createWriteStream(videoPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Downloaded: ${filename}`);
          resolve(videoPath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`Failed to download video ${metadata.id}:`, error);
      throw error;
    }
  }

  private async downloadThumbnail(metadata: VideoMetadata): Promise<string> {
    const filename = `${metadata.id}_${metadata.generation_id}_thumbnail.webp`;
    const thumbnailPath = path.join(this.outputDir, 'videos', filename);

    if (fs.existsSync(thumbnailPath)) {
      return thumbnailPath;
    }

    try {
      const response = await axios({
        method: 'GET',
        url: metadata.thumbnail_url,
        responseType: 'stream',
        timeout: 15000
      });

      const writer = fs.createWriteStream(thumbnailPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(thumbnailPath));
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`Failed to download thumbnail for ${metadata.id}:`, error);
      // Don't throw error for thumbnails, just log it
      return '';
    }
  }

  private saveMetadata(metadata: VideoMetadata, videoPath: string, thumbnailPath: string): void {
    // Convert VideoMetadata to VideoItem format for unified metadata
    const videoItem: VideoItem = {
      id: metadata.id,
      title: metadata.text || `Post ${metadata.id}`,
      description: metadata.text,
      videoUrl: metadata.video_url,
      thumbnailUrl: metadata.thumbnail_url,
      prompt: metadata.text, // Use text as prompt for local feeds
      source: 'local-feed',
      generationId: metadata.generation_id,
      createdAt: new Date(metadata.posted_at * 1000).toISOString(),
      updatedAt: new Date(metadata.updated_at * 1000).toISOString()
    };

    // Use unified metadata writing from VideoDownloader
    const metadataPath = this.downloader.writeMetadata(videoItem, videoPath, thumbnailPath);
    console.log(`Saved metadata: ${path.basename(metadataPath)}`);
  }

  private async processPost(post: SoraPost): Promise<void> {
    try {
      const metadata = this.extractMetadata(post);

      // Download video and thumbnail concurrently
      const [videoPath, thumbnailPath] = await Promise.all([
        this.downloadVideo(metadata),
        this.downloadThumbnail(metadata)
      ]);

      // Save metadata with download paths
      this.saveMetadata(metadata, videoPath, thumbnailPath);

    } catch (error) {
      console.error(`Error processing post ${post.id}:`, error);
    }
  }

  async processAllPosts(maxConcurrent: number = 3): Promise<VideoMetadata[]> {
    const posts = this.feedData.items.map(item => item.post);
    const allMetadata: VideoMetadata[] = [];

    console.log(`Processing ${posts.length} posts with max ${maxConcurrent} concurrent downloads`);

    // Process posts in batches
    for (let i = 0; i < posts.length; i += maxConcurrent) {
      const batch = posts.slice(i, i + maxConcurrent);
      console.log(`Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(posts.length / maxConcurrent)}`);

      const batchPromises = batch.map(post => this.processPost(post));
      await Promise.all(batchPromises);

      // Extract metadata for this batch
      const batchMetadata = batch.map(post => {
        try {
          return this.extractMetadata(post);
        } catch (error) {
          console.error(`Error extracting metadata for post ${post.id}:`, error);
          return null;
        }
      }).filter(Boolean) as VideoMetadata[];

      allMetadata.push(...batchMetadata);
    }

    // Save complete metadata summary
    const summaryPath = path.join(this.outputDir, 'complete_metadata.json');
    fs.writeFileSync(summaryPath, JSON.stringify(allMetadata, null, 2));
    console.log(`Saved complete metadata summary: ${summaryPath}`);

    return allMetadata;
  }

  async processRecentPosts(count: number = 10, maxConcurrent: number = 3): Promise<VideoMetadata[]> {
    const posts = this.feedData.items.slice(0, count).map(item => item.post);
    const allMetadata: VideoMetadata[] = [];

    console.log(`Processing ${posts.length} recent posts with max ${maxConcurrent} concurrent downloads`);

    // Process posts in batches
    for (let i = 0; i < posts.length; i += maxConcurrent) {
      const batch = posts.slice(i, i + maxConcurrent);

      const batchPromises = batch.map(post => this.processPost(post));
      await Promise.all(batchPromises);

      // Extract metadata for this batch
      const batchMetadata = batch.map(post => {
        try {
          return this.extractMetadata(post);
        } catch (error) {
          console.error(`Error extracting metadata for post ${post.id}:`, error);
          return null;
        }
      }).filter(Boolean) as VideoMetadata[];

      allMetadata.push(...batchMetadata);
    }

    return allMetadata;
  }

  getPostsCount(): number {
    return this.feedData.items.length;
  }

  listPosts(): void {
    console.log(`Found ${this.feedData.items.length} posts in feed:`);
    this.feedData.items.forEach((item, index) => {
      const post = item.post;
      console.log(`${index + 1}. ID: ${post.id}`);
      console.log(`   Shared by: ${post.shared_by}`);
      console.log(`   Posted: ${new Date(post.posted_at * 1000).toISOString()}`);
      console.log(`   Likes: ${post.like_count}, Views: ${post.view_count}`);
      console.log(`   Preview: ${post.preview_image_url}`);
      console.log(`   Text: ${post.text.substring(0, 100)}...`);
      console.log('');
    });
  }
}