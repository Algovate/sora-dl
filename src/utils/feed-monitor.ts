import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FeedMonitorOptions {
  interval?: number;
  iterations?: number;
  outputDir?: string;
  cookies?: string;
}

export interface FeedFile {
  file: string;
  timestamp: string;
  iteration: number;
  data: any;
}

export interface FeedComparison {
  iteration: number;
  timestamp: string;
  previousTimestamp: string;
  changes: {
    totalItems: {
      previous: number;
      current: number;
      difference: number;
    };
    newItems: Array<{
      id: string;
      text: string;
      posted_at: string;
    }>;
    removedItems: Array<{
      id: string;
      text: string;
      posted_at: string;
    }>;
    modifiedItems: Array<{
      id: string;
      changes: Array<{
        path: string;
        type: string;
        oldValue?: any;
        newValue?: any;
      }>;
    }>;
  };
}

export class FeedMonitor {
  private interval: number;
  private iterations: number;
  private outputDir: string;
  private cookies: string;
  private currentIteration: number;
  private feedFiles: FeedFile[];
  private startTime: number;

  constructor(options: FeedMonitorOptions = {}) {
    this.interval = options.interval || 10000; // 10 seconds
    this.iterations = options.iterations || 10;
    this.outputDir = options.outputDir || './feed-monitor-results';
    this.cookies = options.cookies || '';
    this.currentIteration = 0;
    this.feedFiles = [];
    this.startTime = Date.now();

    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Execute sora-dl feed command and return the result
   */
  async fetchFeed(): Promise<any> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(this.outputDir, `feed-${timestamp}.json`);

    // Use --output flag to save directly to file, which is more reliable for large outputs
    const command = `node dist/cli.js feed --pretty --output "${outputFile}"`;
    const fullCommand = this.cookies ? 
      `node dist/cli.js feed --pretty --output "${outputFile}" --cookies "${this.cookies}"` : 
      command;

    console.log(`🔄 [${this.currentIteration + 1}/${this.iterations}] Fetching feed...`);
    console.log(`📁 Saving to: ${outputFile}`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer to handle large feed outputs
      });

      if (stderr) {
        console.warn(`⚠️  Warning: ${stderr}`);
      }

      // Since we used --output flag, the file should already be saved
      // Just need to read it back and validate
      if (!fs.existsSync(outputFile)) {
        throw new Error(`Output file was not created: ${outputFile}`);
      }

      // Read the saved file
      const fileContent = fs.readFileSync(outputFile, 'utf8');
      const feedData = JSON.parse(fileContent);

      this.feedFiles.push({
        file: outputFile,
        timestamp: timestamp,
        iteration: this.currentIteration + 1,
        data: feedData
      });

      console.log(`✅ Feed saved successfully (${feedData.items?.length || 0} items)`);
      return feedData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error fetching feed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Wait for specified interval
   */
  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run the monitoring process
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Feed Monitor');
    console.log(`📊 Iterations: ${this.iterations}`);
    console.log(`⏱️  Interval: ${this.interval / 1000} seconds`);
    console.log(`📁 Output Directory: ${this.outputDir}`);
    console.log('='.repeat(50));

    try {
      for (let i = 0; i < this.iterations; i++) {
        this.currentIteration = i;

        await this.fetchFeed();

        // Wait before next iteration (except for the last one)
        if (i < this.iterations - 1) {
          console.log(`⏳ Waiting ${this.interval / 1000} seconds...`);
          await this.wait(this.interval);
        }
      }

      console.log('\n🎉 All iterations completed!');
      await this.generateComparisonReport();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Monitor failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Compare feed data between iterations
   */
  compareFeeds(): FeedComparison[] {
    const comparisons: FeedComparison[] = [];

    for (let i = 1; i < this.feedFiles.length; i++) {
      const current = this.feedFiles[i].data;
      const previous = this.feedFiles[i - 1].data;

      const comparison: FeedComparison = {
        iteration: i + 1,
        timestamp: this.feedFiles[i].timestamp,
        previousTimestamp: this.feedFiles[i - 1].timestamp,
        changes: {
          totalItems: {
            previous: previous.items?.length || 0,
            current: current.items?.length || 0,
            difference: (current.items?.length || 0) - (previous.items?.length || 0)
          },
          newItems: [],
          removedItems: [],
          modifiedItems: []
        }
      };

      // Compare items
      const currentIds = new Set((current.items || []).map((item: any) => item.post?.id));
      const previousIds = new Set((previous.items || []).map((item: any) => item.post?.id));

      // Find new items
      for (const item of current.items || []) {
        if (!previousIds.has(item.post?.id)) {
          comparison.changes.newItems.push({
            id: item.post?.id,
            text: item.post?.text?.substring(0, 100) + '...',
            posted_at: item.post?.posted_at
          });
        }
      }

      // Find removed items
      for (const item of previous.items || []) {
        if (!currentIds.has(item.post?.id)) {
          comparison.changes.removedItems.push({
            id: item.post?.id,
            text: item.post?.text?.substring(0, 100) + '...',
            posted_at: item.post?.posted_at
          });
        }
      }

      // Find modified items (same ID but different content)
      for (const currentItem of current.items || []) {
        const previousItem = (previous.items || []).find((item: any) => item.post?.id === currentItem.post?.id);
        if (previousItem && JSON.stringify(currentItem) !== JSON.stringify(previousItem)) {
          comparison.changes.modifiedItems.push({
            id: currentItem.post?.id,
            changes: this.getObjectDifferences(previousItem, currentItem)
          });
        }
      }

      comparisons.push(comparison);
    }

    return comparisons;
  }

  /**
   * Get differences between two objects
   */
  private getObjectDifferences(obj1: any, obj2: any): Array<{path: string, type: string, oldValue?: any, newValue?: any}> {
    const differences: Array<{path: string, type: string, oldValue?: any, newValue?: any}> = [];

    const compareObjects = (o1: any, o2: any, path = '') => {
      for (const key in o2) {
        const currentPath = path ? `${path}.${key}` : key;

        if (!(key in o1)) {
          differences.push({ path: currentPath, type: 'added', newValue: o2[key] });
        } else if (typeof o2[key] === 'object' && o2[key] !== null && typeof o1[key] === 'object' && o1[key] !== null) {
          compareObjects(o1[key], o2[key], currentPath);
        } else if (o1[key] !== o2[key]) {
          differences.push({
            path: currentPath,
            type: 'modified',
            oldValue: o1[key],
            newValue: o2[key]
          });
        }
      }
    };

    compareObjects(obj1, obj2);
    return differences;
  }

  /**
   * Generate comprehensive comparison report
   */
  async generateComparisonReport(): Promise<void> {
    console.log('\n📊 Generating comparison report...');

    const comparisons = this.compareFeeds();
    const totalDuration = Date.now() - this.startTime;

    const report = {
      summary: {
        totalIterations: this.iterations,
        totalDuration: totalDuration,
        averageInterval: totalDuration / this.iterations,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString()
      },
      iterations: this.feedFiles.map(file => ({
        iteration: file.iteration,
        timestamp: file.timestamp,
        itemCount: file.data.items?.length || 0,
        videoCount: (file.data.items || []).filter((item: any) =>
          item.post?.attachments?.some((att: any) => att.kind === 'sora')
        ).length
      })),
      comparisons: comparisons,
      statistics: {
        totalNewItems: comparisons.reduce((sum, comp) => sum + comp.changes.newItems.length, 0),
        totalRemovedItems: comparisons.reduce((sum, comp) => sum + comp.changes.removedItems.length, 0),
        totalModifiedItems: comparisons.reduce((sum, comp) => sum + comp.changes.modifiedItems.length, 0),
        averageItemsPerIteration: this.feedFiles.reduce((sum, file) => sum + (file.data.items?.length || 0), 0) / this.feedFiles.length,
        minItems: Math.min(...this.feedFiles.map(file => file.data.items?.length || 0)),
        maxItems: Math.max(...this.feedFiles.map(file => file.data.items?.length || 0))
      }
    };

    // Save detailed report
    const reportFile = path.join(this.outputDir, 'comparison-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Generate human-readable summary
    this.printSummaryReport(report);

    console.log(`\n📄 Detailed report saved to: ${reportFile}`);
  }

  /**
   * Print human-readable summary
   */
  private printSummaryReport(report: any): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FEED MONITOR SUMMARY REPORT');
    console.log('='.repeat(60));

    console.log(`\n⏱️  Duration: ${(report.summary.totalDuration / 1000).toFixed(1)} seconds`);
    console.log(`🔄 Iterations: ${report.summary.totalIterations}`);
    console.log(`📈 Average interval: ${(report.summary.averageInterval / 1000).toFixed(1)} seconds`);

    console.log(`\n📊 Statistics:`);
    console.log(`   • Average items per iteration: ${report.statistics.averageItemsPerIteration.toFixed(1)}`);
    console.log(`   • Min items: ${report.statistics.minItems}`);
    console.log(`   • Max items: ${report.statistics.maxItems}`);
    console.log(`   • Total new items: ${report.statistics.totalNewItems}`);
    console.log(`   • Total removed items: ${report.statistics.totalRemovedItems}`);
    console.log(`   • Total modified items: ${report.statistics.totalModifiedItems}`);

    console.log(`\n📋 Iteration Details:`);
    report.iterations.forEach((iter: any) => {
      console.log(`   ${iter.iteration}. ${iter.timestamp} - ${iter.itemCount} items (${iter.videoCount} videos)`);
    });

    if (report.comparisons.length > 0) {
      console.log(`\n🔄 Changes Between Iterations:`);
      report.comparisons.forEach((comp: any) => {
        console.log(`   Iteration ${comp.iteration}:`);
        console.log(`     • Items: ${comp.changes.totalItems.previous} → ${comp.changes.totalItems.current} (${comp.changes.totalItems.difference >= 0 ? '+' : ''}${comp.changes.totalItems.difference})`);
        console.log(`     • New: ${comp.changes.newItems.length}, Removed: ${comp.changes.removedItems.length}, Modified: ${comp.changes.modifiedItems.length}`);

        if (comp.changes.newItems.length > 0) {
          console.log(`     • New items:`);
          comp.changes.newItems.slice(0, 3).forEach((item: any) => {
            console.log(`       - ${item.id}: ${item.text}`);
          });
          if (comp.changes.newItems.length > 3) {
            console.log(`       ... and ${comp.changes.newItems.length - 3} more`);
          }
        }
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}
