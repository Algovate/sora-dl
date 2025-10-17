import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SoraAPI } from '../../lib/api';
import { handleError } from '../../utils/common/error-handler';
import { addFeedOptions } from '../common-options';
import { FeedMonitor } from '../../utils/monitoring/monitor';
import { FeedChartGenerator } from '../../utils/monitoring/chart';

export function createFeedCommand(): Command {
  const command = new Command('feed')
    .description('Fetch and display raw Sora feed JSON');

  addFeedOptions(command)
    .action(async (options) => {
      try {
        // Handle chart generation
        if (options.chart) {
          console.log('📊 Generating charts from monitoring data...');
          const chartGenerator = new FeedChartGenerator(options.report, options.chartOutput);

          if (chartGenerator.loadReport()) {
            chartGenerator.generateAllCharts();
          } else {
            console.error('❌ Failed to load report for chart generation');
            process.exit(1);
          }
          return;
        }

        // Handle monitoring mode
        if (options.monitor) {
          console.log('🔄 Starting feed monitoring...');
          const monitor = new FeedMonitor({
            interval: (options.interval || 10) * 1000, // Convert to milliseconds
            iterations: options.iterations || 10,
            outputDir: options.output || './feed-monitor-results',
            cookies: options.cookies
          });

          await monitor.run();
          return;
        }

        // Default behavior: fetch and display raw feed
        const api = new SoraAPI(options.cookies);
        console.log('Fetching raw Sora feed...');

        const rawFeed = await api.getRawFeed();

        // Display the raw feed JSON
        const jsonOutput = options.pretty
          ? JSON.stringify(rawFeed, null, 2)
          : JSON.stringify(rawFeed);

        console.log('\n📄 Raw Sora Feed JSON:');
        console.log('=' .repeat(50));
        console.log(jsonOutput);
        console.log('=' .repeat(50));

        // Show summary information
        if (rawFeed.items && Array.isArray(rawFeed.items)) {
          console.log(`\n📊 Feed Summary:`);
          console.log(`   • Total items: ${rawFeed.items.length}`);

          const videoItems = rawFeed.items.filter((item: any) =>
            item.post?.attachments?.some((att: any) => att.kind === 'sora')
          );
          console.log(`   • Video items: ${videoItems.length}`);

          // Note: cursor information would be in the response if available
        }

        // Save to file if requested
        if (options.output) {
          // Ensure the output directory exists
          const outputDir = path.dirname(options.output);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          fs.writeFileSync(options.output, jsonOutput);
          console.log(`\n💾 Raw feed saved to: ${options.output}`);
        }
      } catch (error) {
        handleError(error, 'fetching raw feed');
      }
    });

  return command;
}
