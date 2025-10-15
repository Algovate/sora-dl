# Sora Downloader

Download Sora videos with metadata from OpenAI's Sora feed.

## Install

```bash
git clone <repository-url>
cd sora-dl
npm install
npm run build
```

## Quick Start

### Option 1: Download from Local Files (No Setup Required)

```bash
# Download from local feed file (no cookies needed)
sora-dl download local feed.json --all

# Download single video by URL (no cookies needed)
sora-dl download url --url "https://videos.openai.com/..." --title "my_video"
```

### Option 2: Download from Live Feed (Cookies Required)

```bash
# 1. Get cookies first
sora-dl cookies extract --save

# 2. List available videos
sora-dl feed

# 3. Download videos
sora-dl download feed --count 5
sora-dl download feed --all
```

**Note:** Commands that access the live Sora feed (`feed`, `download feed`) require authentication cookies. Commands that work with local files (`download local`, `download url`) don't need cookies.

## Commands

### `feed` - List Videos
```bash
sora-dl feed [options]
```
- `-c, --cookies <cookies>` - Authentication cookies
- `-o, --output <file>` - Save feed to file
- `--raw <file>` - Save raw API response

### `download` - Download Videos

#### `download feed` - From Remote Feed
```bash
sora-dl download feed [options]
```
- `-n, --count <number>` - Number to download (default: 10)
- `--all` - Download everything
- `-o, --output-dir <dir>` - Output folder (default: ./downloads)
- `--overwrite` - Replace existing files
- `--concurrent <number>` - Parallel downloads (default: 3)

#### `download local` - From Local File
```bash
sora-dl download local <feed-file> [options]
```
- Same options as `download feed`
- `--list` - Show videos without downloading

#### `download url` - Single Video
```bash
sora-dl download url --url <video-url> [options]
```
- `-t, --title <title>` - Custom filename
- `-o, --output-dir <dir>` - Output folder
- `--overwrite` - Replace existing files

### `cookies` - Manage Authentication

```bash
sora-dl cookies [subcommand]
```

#### Subcommands:
- `extract` - Auto-extract from browser
- `import <browser>` - Import from browser files
- `save <cookies>` - Save manually
- `validate` - Test saved cookies
- `show` - View saved cookies

## Manual Cookie Setup

1. Open https://sora.chatgpt.com/ in browser
2. Open Developer Tools (F12)
3. Go to Network tab
4. Refresh page
5. Find request to `backend/public/nf2/feed`
6. Copy Cookie header value
7. Run: `sora-dl cookies save "cookie_value"`

## Output Structure

```
downloads/
├── videos/
│   ├── video_title.mp4
│   └── video_title_thumbnail.webp
└── metadata/
    └── video_title_metadata.json
```

Each download includes:
- **Video file** (`.mp4`)
- **Thumbnail** (`.webp`, if available)  
- **Metadata** (`.json`) with title, prompt, URLs, timestamps

## Examples

```bash
# Download workflow
sora-dl cookies extract --save          # Setup once
sora-dl feed                            # See what's available
sora-dl download feed --count 3         # Download 3 videos

# Batch processing
sora-dl feed --raw feed.json            # Save raw feed
sora-dl download local feed.json --all  # Process offline

# Single video
sora-dl download url --url "https://..." --title "my_video"
```

## Troubleshooting

- **"No cookies provided"** → Run `sora-dl cookies` for setup help
- **"Feed file not found"** → Check file path exists
- **"API request failed"** → Cookies may be expired, try `sora-dl cookies validate`
- **Network errors** → Built-in retry handles temporary failures

## License

MIT