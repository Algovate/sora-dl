import { Command } from 'commander';

export interface CommonOptions {
  debug?: boolean;
  logToFile?: boolean;
  logLevel?: string;
  verbose?: boolean;
}

export interface DownloadOptions extends CommonOptions {
  outputDir?: string;
  overwrite?: boolean;
  concurrent?: number;
  count?: number;
  all?: boolean;
}


export interface OutputOptions extends CommonOptions {
  output?: string;
  pretty?: boolean;
}

// Common option definitions
export const COMMON_DEBUG_OPTIONS = [
  ['--debug', 'Enable debug logging', false],
  ['--log-to-file', 'Save logs to file', false],
  ['--log-level <level>', 'Set log level (error, warn, info, debug, trace)', 'info']
] as const;

export const COMMON_VERBOSE_OPTIONS = [
  ['--verbose', 'Show detailed progress information', false]
] as const;

export const COMMON_OUTPUT_OPTIONS = [
  ['-o, --output <file>', 'Output file path'],
  ['--pretty', 'Pretty print output (default: true)', true]
] as const;

export const COMMON_DOWNLOAD_OPTIONS = [
  ['-o, --output-dir <dir>', 'Output directory for downloaded files', './downloads'],
  ['--overwrite', 'Overwrite existing files', false],
  ['--concurrent <number>', 'Maximum concurrent downloads', '3']
] as const;

export const COMMON_COUNT_OPTIONS = [
  ['-n, --count <number>', 'Number of items to process', '10'],
  ['--all', 'Process all available items', false]
] as const;


// Helper functions to add common options to commands
export function addDebugOptions(command: Command): Command {
  COMMON_DEBUG_OPTIONS.forEach(([option, description, defaultValue]) => {
    command.option(option, description, defaultValue);
  });
  return command;
}

export function addVerboseOptions(command: Command): Command {
  COMMON_VERBOSE_OPTIONS.forEach(([option, description, defaultValue]) => {
    command.option(option, description, defaultValue);
  });
  return command;
}

export function addOutputOptions(command: Command): Command {
  COMMON_OUTPUT_OPTIONS.forEach(([option, description, defaultValue]) => {
    command.option(option, description, defaultValue);
  });
  return command;
}

export function addDownloadOptions(command: Command): Command {
  COMMON_DOWNLOAD_OPTIONS.forEach(([option, description, defaultValue]) => {
    command.option(option, description, defaultValue);
  });
  return command;
}

export function addCountOptions(command: Command): Command {
  COMMON_COUNT_OPTIONS.forEach(([option, description, defaultValue]) => {
    command.option(option, description, defaultValue);
  });
  return command;
}


// Combined option sets for common use cases
export function addCommonOptions(command: Command): Command {
  return addDebugOptions(addVerboseOptions(command));
}

export function addDownloadCommonOptions(command: Command): Command {
  return addCommonOptions(addDownloadOptions(addCountOptions(command)));
}

export function addFeedOptions(command: Command): Command {
  command
    .option('-c, --cookies <cookies>', 'Cookies string for authentication');
  return addOutputOptions(command);
}

export function addDownloadFeedOptions(command: Command): Command {
  command
    .option('-c, --cookies <cookies>', 'Cookies string for authentication');
  return addDownloadCommonOptions(command);
}

export function addDownloadUrlOptions(command: Command): Command {
  // Single video download is simple, doesn't need debug options
  command
    .option('-u, --url <url>', 'Video URL to download')
    .option('-t, --title <title>', 'Video title for filename')
    .option('-o, --output-dir <dir>', 'Output directory for downloaded video', './downloads')
    .option('--overwrite', 'Overwrite existing files', false);
  return command;
}

export function addDownloadLocalOptions(command: Command): Command {
  addDownloadCommonOptions(command);
  command
    .argument('<feed-file>', 'Path to the local feed.json file')
    .option('--list', 'List posts in the feed without downloading', false);
  return command;
}


export function addConfigOptions(command: Command): Command {
  // Config commands don't need debug options - they're simple operations
  return command;
}
