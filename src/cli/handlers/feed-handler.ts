import { Command } from 'commander';
import * as fs from 'fs';
import { SoraAPI } from '../../api';
import { handleError } from '../../utils/error-handler';
import { addFeedOptions } from '../common-options';

export function createFeedCommand(): Command {
  const command = new Command('feed')
    .description('Fetch and display raw Sora feed JSON');
  
  addFeedOptions(command)
    .action(async (options) => {
      try {

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
          fs.writeFileSync(options.output, jsonOutput);
          console.log(`\n💾 Raw feed saved to: ${options.output}`);
        }
      } catch (error) {
        handleError(error, 'fetching raw feed');
      }
    });

  return command;
}
