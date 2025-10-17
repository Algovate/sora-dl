# Sora Downloader

A powerful TypeScript CLI tool for downloading Sora videos with metadata from OpenAI's Sora feed. Features organized commands, feed monitoring, data visualization, and flexible download options.

[![npm version](https://badge.fury.io/js/sora-dl.svg)](https://badge.fury.io/js/sora-dl)
[![npm downloads](https://img.shields.io/npm/dm/sora-dl.svg)](https://www.npmjs.com/package/sora-dl)

## Install

### Option 1: Install from npm (Recommended)

```bash
npm install -g sora-dl
```

### Option 2: Install from source

```bash
git clone <repository-url>
cd sora-dl
npm install
npm run build
```

### Option 3: Use without install

```bash
npx sora-dl --help
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
# 1. Get cookies from browser (see Authentication Setup below)

# 2. Fetch and view raw feed data
sora-dl feed --cookies "your-cookie-string"

# 3. Download videos
sora-dl download feed --cookies "your-cookie-string" --count 5
sora-dl download feed --cookies "your-cookie-string" --all
```

**Note:** Commands that access the live Sora feed (`feed`, `download feed`) require authentication cookies to be provided via the `--cookies` option. Commands that work with local files (`download local`, `download url`) don't need cookies.

## Features

- 🎯 **Organized Commands** - Logical grouping of related functionality
- 📁 **Flexible Downloads** - Remote feed, local files, or single URLs
- ⚙️ **Configuration Management** - Persistent settings and preferences
- 🔧 **Debug Support** - Comprehensive logging and troubleshooting
- 📊 **Progress Tracking** - Visual progress bars and batch operations
- 🛡️ **Error Handling** - Robust retry mechanisms and validation
- 📈 **Feed Monitoring** - Track feed changes over time with detailed analytics
- 📉 **Data Visualization** - Generate ASCII charts, tables, and interactive HTML charts

## Command Structure

The CLI is organized into logical command groups:

```
sora-dl
├── feed                    # Fetch raw feed data
├── download                # Download videos
│   ├── feed               # From remote feed
│   ├── url                # From specific URL
│   └── local              # From local feed file
└── config                 # Configuration management
    ├── show               # Show current config
    ├── set                # Set config values
    └── reset              # Reset to defaults
```

## Commands

### `feed` - Fetch Raw Feed Data

```bash
sora-dl feed [options]
```

#### Basic Feed Operations

- `-o, --output <file>` - Save raw feed JSON to file
- `--pretty` - Pretty print JSON output (default: true)
- `-c, --cookies <cookies>` - Authentication cookies for live feed access

#### Monitor Feed Changes

- `--monitor` - Monitor feed changes over time
- `--iterations <number>` - Number of monitoring iterations (default: "10")
- `--interval <seconds>` - Interval between fetches in seconds (default: "10")

#### Generate Charts

- `--chart` - Generate charts from monitoring data
- `--report <path>` - Path to comparison report JSON file (default: ./feed-monitor-results/comparison-report.json)
- `--chart-output <path>` - Output directory for chart files (default: ./feed-monitor-results)

### `download` - Download Videos

#### `download feed` - From Remote Feed
```bash
sora-dl download feed [options]
```
- `-c, --cookies <cookies>` - Cookies string for authentication
- `-n, --count <number>` - Number to download (default: "10")
- `--all` - Download everything
- `-o, --output-dir <dir>` - Output folder (default: ./downloads)
- `--overwrite` - Replace existing files
- `--concurrent <number>` - Parallel downloads (default: "3")
- `--verbose` - Show detailed progress
- `--debug` - Enable debug logging
- `--log-to-file` - Save logs to file
- `--log-level <level>` - Set log level (error, warn, info, debug, trace)

#### `download local` - From Local File
```bash
sora-dl download local <feed-file> [options]
```
- `-n, --count <number>` - Number to download (default: "10")
- `--all` - Download everything
- `-o, --output-dir <dir>` - Output folder (default: ./downloads)
- `--overwrite` - Replace existing files
- `--concurrent <number>` - Parallel downloads (default: "3")
- `--verbose` - Show detailed progress
- `--debug` - Enable debug logging
- `--log-to-file` - Save logs to file
- `--log-level <level>` - Set log level (error, warn, info, debug, trace)
- `--list` - Show videos without downloading

#### `download url` - Single Video
```bash
sora-dl download url --url <video-url> [options]
```
- `-t, --title <title>` - Custom filename
- `-o, --output-dir <dir>` - Output folder
- `--overwrite` - Replace existing files


### `config` - Configuration Management

```bash
sora-dl config [subcommand]
```

#### Subcommands:
- `show` - Display current configuration
- `set` - Set configuration values
  - `--output-dir <dir>` - Set default output directory
  - `--max-concurrent <number>` - Set max concurrent downloads
  - `--overwrite <boolean>` - Set overwrite mode
  - `--log-level <level>` - Set default log level
  - `--debug <boolean>` - Set debug mode
- `reset` - Reset to default values
  - `--confirm` - Skip confirmation prompt

## Global Options

All commands support these global options:

- `--debug` - Enable debug logging globally
- `--log-to-file` - Save logs to file globally
- `--log-level <level>` - Set log level globally (error, warn, info, debug, trace)

**Note**: Some commands also have their own debug options for convenience, but global options work everywhere.

### Debug Options Strategy

- **Global Options**: Work with any command (`--debug`, `--log-to-file`, `--log-level`)
- **Command-Specific Options**: Available only for complex operations that benefit from detailed logging
  - `download feed` and `download local` have full debug options
  - Simple commands like `config`, `feed`, `download url` use global options only
- **Clean Interface**: Commands show only relevant options, reducing confusion

## Authentication Setup

To access the live Sora feed, you need to provide authentication cookies:

1. Open https://sora.chatgpt.com/ in browser
2. Open Developer Tools (F12)
3. Go to Network tab
4. Refresh page
5. Find request to `backend/public/nf2/feed`
6. Copy Cookie header value
7. Use with commands: `sora-dl feed --cookies "your-cookie-string"`

## Output Structure

### Download Output
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

### Monitoring Output
```
feed-monitor-results/
├── feed-2024-01-15T10-30-00-000Z.json    # Individual feed snapshots
├── feed-2024-01-15T10-30-10-000Z.json
├── feed-2024-01-15T10-30-20-000Z.json
├── comparison-report.json                # Detailed analysis report
└── feed-chart.html                       # Interactive HTML charts
```

Monitoring generates:
- **Individual feed files** (`.json`) - Timestamped snapshots of feed data
- **Comparison report** (`.json`) - Detailed analysis with statistics and change tracking
- **Interactive charts** (`.html`) - Web-based charts using Chart.js for visualization
- **Console output** - ASCII charts and data tables for terminal viewing

## Examples

### Basic Workflow
```bash
# View available videos (requires cookies)
sora-dl feed --cookies "your-cookie-string"

# Download videos (requires cookies)
sora-dl download feed --cookies "your-cookie-string" --count 3
sora-dl download feed --cookies "your-cookie-string" --all
```

### Configuration Management
```bash
# View current settings
sora-dl config show

# Set custom defaults
sora-dl config set --output-dir ./my-downloads
sora-dl config set --max-concurrent 5
sora-dl config set --debug true

# Reset to defaults
sora-dl config reset --confirm
```

### Batch Processing
```bash
# Save raw feed for offline processing
sora-dl feed -o feed.json

# Process offline
sora-dl download local feed.json --all
```

### Single Video Download
```bash
# Download specific video
sora-dl download url --url "https://..." --title "my_video"
```

### Feed Monitoring and Analytics
```bash
# Monitor feed changes for 5 iterations every 30 seconds
sora-dl feed --monitor --iterations 5 --interval 30 --cookies "your-cookie-string"

# Monitor with custom output directory
sora-dl feed --monitor --iterations 10 --interval 15 --output ./my-monitor-results --cookies "your-cookie-string"

# Generate charts from monitoring data
sora-dl feed --chart --report ./feed-monitor-results/comparison-report.json

# Generate charts to custom directory
sora-dl feed --chart --chart-output ./my-charts --report ./feed-monitor-results/comparison-report.json
```

### Debug and Troubleshooting
```bash
# Global debug options (work with any command)
sora-dl --debug feed --cookies "your-cookie-string"
sora-dl --log-level debug config show
sora-dl --log-to-file download feed --cookies "your-cookie-string" --count 1

# Command-specific debug options (where available)
sora-dl download feed --cookies "your-cookie-string" --debug --verbose --count 1
sora-dl download local feed.json --debug --all

# Simple commands (use global options)
sora-dl --debug config show
```

## Troubleshooting

### Common Issues
- **"No cookies provided"** → Use `--cookies` option with authentication string
- **"Feed file not found"** → Check file path exists
- **"API request failed"** → Cookies may be expired, try with fresh cookies
- **Network errors** → Built-in retry handles temporary failures
- **"Report file not found"** → Run monitoring first to generate comparison report
- **"No iteration data found"** → Ensure monitoring completed successfully

### Debug Commands
```bash
# View current configuration
sora-dl config show

# Enable debug logging (global options work everywhere)
sora-dl --debug --log-to-file feed --cookies "your-cookie-string"
sora-dl --log-level debug download feed --cookies "your-cookie-string" --count 1

# Use command-specific debug options (where available)
sora-dl download feed --cookies "your-cookie-string" --debug --verbose --count 1

# Monitor with debug output
sora-dl --debug feed --monitor --iterations 3 --interval 5 --cookies "your-cookie-string"

# Generate charts with debug output
sora-dl --debug feed --chart --report ./feed-monitor-results/comparison-report.json
```

### Getting Help
```bash
# General help
sora-dl --help

# Command-specific help
sora-dl feed --help
sora-dl download --help
sora-dl config --help
```

## Architecture

### Core Components
- **BaseService** - Common patterns for logging, error handling, and retry mechanisms
- **ConfigManager** - Centralized configuration management with validation
- **ProgressManager** - Visual progress tracking for downloads and batch operations
- **ValidationUtils** - Type-safe input validation and type guards
- **Logger** - Structured logging with multiple levels and file output

### Command Handlers
- **feed-handler.ts** - Raw feed data fetching, monitoring, and chart generation
- **download-handler.ts** - Video download operations (feed, url, local)
- **cookie-handler.ts** - Authentication management and validation
- **config-handler.ts** - Configuration viewing and modification

### Monitoring Utilities
- **feed-monitor.ts** - Feed monitoring functionality with comparison analysis
- **feed-chart.ts** - Chart generation (ASCII, tables, and HTML visualizations)

### Common Options
- **Debug Options** - `--debug`, `--log-to-file`, `--log-level`
- **Download Options** - `--output-dir`, `--overwrite`, `--concurrent`
- **Output Options** - `--output`, `--pretty` for data display
- **Monitor Options** - `--monitor`, `--iterations`, `--interval` for feed monitoring
- **Chart Options** - `--chart`, `--report`, `--chart-output` for data visualization

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

### Development Mode
```bash
npm run dev
```

## License

MIT