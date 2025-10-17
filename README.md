# Sora Downloader

A powerful TypeScript CLI tool for downloading Sora videos with metadata from OpenAI's Sora feed.

[![npm version](https://badge.fury.io/js/sora-dl.svg)](https://badge.fury.io/js/sora-dl)
[![npm downloads](https://img.shields.io/npm/dm/sora-dl.svg)](https://www.npmjs.com/package/sora-dl)

## Install

```bash
# From npm (recommended)
npm install -g sora-dl

# Or use without install
npx sora-dl --help

# From source
git clone https://github.com/algovate/sora-dl.git
cd sora-dl && npm install && npm run build
```

## Quick Start

```bash
# Download from local feed file (no cookies needed)
sora-dl download local feed.json --all

# Download single video by URL
sora-dl download url --url "https://videos.openai.com/..." --title "my_video"

# Download from live feed (requires cookies)
sora-dl download feed --cookies "your-cookie-string" --count 5
```

### Key Options

- `--cookies <string>` - Authentication for live feed access
- `--count <number>` - Number of videos to download (default: 10)
- `--all` - Download all available videos
- `--output-dir <dir>` - Output directory (default: ./downloads)
- `--debug` - Enable debug logging

## Output

Downloads include:
- Video file (`.mp4`)
- Thumbnail (`.webp`, if available) 
- Metadata (`.json`) with title, prompt, URLs, timestamps

## Examples

```bash
# Save feed for offline processing
sora-dl feed --cookies "your-cookie-string" -o feed.json

# Download from local file
sora-dl download local feed.json --all

# Download specific video
sora-dl download url --url "https://..." --title "my_video"

# Monitor feed changes
sora-dl feed --monitor --cookies "your-cookie-string"

# Configuration
sora-dl config show
sora-dl config set --output-dir ./my-downloads
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm test`
5. Submit a Pull Request

## License

MIT
