import { Command } from 'commander';
import { ConfigManager } from '../../core/config-manager';
import { handleError } from '../../utils/error-handler';
import { setupLogging } from '../logging-setup';
import { addConfigOptions } from '../common-options';

export function createConfigCommand(): Command {
  const command = new Command('config')
    .description('Manage application configuration');

  // Show current configuration
  command
    .command('show')
    .description('Show current configuration settings')
    .action(async () => {
      try {
        const configManager = ConfigManager.getInstance();

        console.log('📋 Current Configuration:');
        console.log('=' .repeat(40));

        // Show app config
        const config = configManager.getConfig();
        console.log('\n🔧 Application Settings:');
        console.log(`   • Output Directory: ${config.outputDir}`);
        console.log(`   • Max Concurrent Downloads: ${config.maxConcurrent}`);
        console.log(`   • Overwrite Files: ${config.overwrite}`);
        console.log(`   • Log Level: ${config.logLevel}`);
        console.log(`   • Debug Mode: ${config.debug}`);

        // Show authentication info
        console.log('\n🔐 Authentication:');
        console.log(`   • Status: ❌ Not supported (cookies removed)`);
        console.log(`   • Note: Authentication must be provided via --cookies option`);

        // Show file paths
        console.log('\n📁 File Paths:');
        console.log(`   • Config File: ${configManager.getConfigPath()}`);
        console.log(`   • Log Directory: ${config.logToFile ? 'logs/' : 'Not enabled'}`);

      } catch (error) {
        handleError(error, 'showing configuration');
      }
    });

  // Set configuration values
  command
    .command('set')
    .description('Set configuration values')
    .option('--output-dir <dir>', 'Set default output directory')
    .option('--max-concurrent <number>', 'Set maximum concurrent downloads')
    .option('--overwrite <boolean>', 'Set overwrite mode (true/false)')
    .option('--log-level <level>', 'Set default log level')
    .option('--debug <boolean>', 'Set debug mode (true/false)')
    .action(async (options) => {
      try {
        const configManager = ConfigManager.getInstance();
        const updates: Record<string, any> = {};

        if (options.outputDir) {
          updates.outputDir = options.outputDir;
          console.log(`📁 Output directory set to: ${options.outputDir}`);
        }

        if (options.maxConcurrent) {
          const concurrent = parseInt(options.maxConcurrent);
          if (isNaN(concurrent) || concurrent < 1) {
            console.error('❌ Max concurrent must be a positive number');
            process.exit(1);
          }
          updates.maxConcurrent = concurrent;
          console.log(`🔄 Max concurrent downloads set to: ${concurrent}`);
        }

        if (options.overwrite !== undefined) {
          const overwrite = options.overwrite === 'true';
          updates.overwrite = overwrite;
          console.log(`⚠️  Overwrite mode set to: ${overwrite}`);
        }

        if (options.logLevel) {
          const validLevels = ['error', 'warn', 'info', 'debug', 'trace'];
          if (!validLevels.includes(options.logLevel)) {
            console.error(`❌ Invalid log level. Must be one of: ${validLevels.join(', ')}`);
            process.exit(1);
          }
          updates.logLevel = options.logLevel;
          console.log(`📝 Log level set to: ${options.logLevel}`);
        }

        if (options.debug !== undefined) {
          const debug = options.debug === 'true';
          updates.debug = debug;
          console.log(`🔧 Debug mode set to: ${debug}`);
        }

        if (Object.keys(updates).length === 0) {
          console.log('❌ No configuration options provided');
          console.log('💡 Use --help to see available options');
          process.exit(1);
        }

        configManager.updateConfig(updates);
        console.log('\n✅ Configuration updated successfully!');

      } catch (error) {
        handleError(error, 'setting configuration');
      }
    });

  // Reset configuration to defaults
  command
    .command('reset')
    .description('Reset configuration to default values')
    .option('--confirm', 'Skip confirmation prompt', false)
    .action(async (options) => {
      try {
        if (!options.confirm) {
          console.log('⚠️  This will reset all configuration to default values.');
          console.log('💡 Use --confirm to skip this prompt');
          return;
        }

        const configManager = ConfigManager.getInstance();
        configManager.resetToDefaults();

        console.log('🔄 Configuration reset to defaults');
        console.log('✅ All settings restored to initial values');

      } catch (error) {
        handleError(error, 'resetting configuration');
      }
    });

  // Show help (default action when no subcommand)
  command
    .action(() => {
      console.log(`
🔧 CONFIGURATION MANAGEMENT:

📋 SHOW CURRENT CONFIG:
   sora-dl config show

⚙️  SET CONFIGURATION VALUES:
   sora-dl config set --output-dir ./my-downloads
   sora-dl config set --max-concurrent 5
   sora-dl config set --overwrite true
   sora-dl config set --log-level debug
   sora-dl config set --debug true

🔄 RESET TO DEFAULTS:
   sora-dl config reset --confirm

💡 TIP: Configuration is saved automatically and used as defaults for all commands!
      `);
    });

  return command;
}
