#!/usr/bin/env node

import { Command } from 'commander';
import { APP_CONFIG } from './config/constants';
import { createFeedCommand } from './cli/handlers/feed-handler';
import { createDownloadFeedCommand, createDownloadUrlCommand, createDownloadLocalCommand } from './cli/handlers/download-handler';
import { createConfigCommand } from './cli/handlers/config-handler';
import { setupLogging } from './cli/logging-setup';

const program = new Command();

program
  .name(APP_CONFIG.NAME)
  .description(APP_CONFIG.DESCRIPTION)
  .version(APP_CONFIG.VERSION)
  .option('--debug', 'Enable debug logging globally')
  .option('--log-to-file', 'Save logs to file globally')
  .option('--log-level <level>', 'Set log level globally (error, warn, info, debug, trace)');

// Handle global debug options
program.hook('preAction', (thisCommand, actionCommand) => {
  const globalOptions = thisCommand.opts();
  if (globalOptions.debug || globalOptions.logToFile || globalOptions.logLevel) {
    setupLogging({
      debug: globalOptions.debug,
      logToFile: globalOptions.logToFile,
      logLevel: globalOptions.logLevel,
      verbose: false
    });
  }
});

// Add commands using modular handlers
program.addCommand(createFeedCommand());

const downloadCmd = program
  .command('download')
  .description('Download videos from various sources');

downloadCmd.addCommand(createDownloadFeedCommand());
downloadCmd.addCommand(createDownloadUrlCommand());
downloadCmd.addCommand(createDownloadLocalCommand());

program.addCommand(createConfigCommand());


program.parse();