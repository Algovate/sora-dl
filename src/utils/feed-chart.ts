import * as fs from 'fs';
import * as path from 'path';

export interface FeedChartGeneratorOptions {
  reportPath: string;
  outputDir?: string;
}

export class FeedChartGenerator {
  private reportPath: string;
  private reportData: any;
  private outputDir: string;

  constructor(reportPath: string, outputDir = './feed-monitor-results') {
    this.reportPath = reportPath;
    this.reportData = null;
    this.outputDir = outputDir;
  }

  /**
   * Load and parse the comparison report
   */
  loadReport(): boolean {
    try {
      if (!fs.existsSync(this.reportPath)) {
        throw new Error(`Report file not found: ${this.reportPath}`);
      }

      const reportContent = fs.readFileSync(this.reportPath, 'utf8');
      this.reportData = JSON.parse(reportContent);

      console.log('✅ Report loaded successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error loading report: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Generate ASCII line chart
   */
  generateASCIIChart(): void {
    if (!this.reportData) {
      console.error('❌ No report data loaded');
      return;
    }

    const iterations = this.reportData.iterations || [];
    if (iterations.length === 0) {
      console.error('❌ No iteration data found');
      return;
    }

    console.log('\n📊 FEED ITEMS OVER TIME - LINE CHART');
    console.log('='.repeat(60));

    // Find the range of values
    const itemCounts = iterations.map((iter: any) => iter.itemCount);
    const maxItems = Math.max(...itemCounts);
    const minItems = Math.min(...itemCounts);
    const range = maxItems - minItems;

    // Determine chart dimensions
    const chartHeight = 20;
    const chartWidth = Math.min(iterations.length * 3, 80);

    // Create the chart
    const chart: string[] = [];

    // Add Y-axis labels and data points
    for (let y = chartHeight; y >= 0; y--) {
      let line = '';

      // Y-axis label
      const value = Math.round(minItems + (range * y / chartHeight));
      const valueStr = value.toString().padStart(4);
      line += `${valueStr} |`;

      // Data points
      for (let x = 0; x < iterations.length; x++) {
        const itemCount = itemCounts[x];
        const normalizedValue = range === 0 ? 0.5 : (itemCount - minItems) / range;
        const chartY = Math.round(normalizedValue * chartHeight);

        if (chartY === y) {
          line += '●'; // Data point
        } else if (chartY < y) {
          line += '│'; // Vertical line below point
        } else {
          line += ' '; // Empty space
        }

        if (x < iterations.length - 1) {
          line += '  '; // Spacing between points
        }
      }

      chart.push(line);
    }

    // Add X-axis
    let xAxis = '     +';
    for (let i = 0; i < chartWidth; i++) {
      xAxis += '-';
    }
    chart.push(xAxis);

    // Add X-axis labels (iteration numbers)
    let xLabels = '      ';
    for (let i = 0; i < iterations.length; i++) {
      xLabels += `${i + 1}`.padStart(3);
    }
    chart.push(xLabels);

    // Print the chart
    console.log(chart.join('\n'));

    // Print summary statistics
    console.log('\n📈 CHART SUMMARY:');
    console.log(`   • Total iterations: ${iterations.length}`);
    console.log(`   • Min items: ${minItems}`);
    console.log(`   • Max items: ${maxItems}`);
    console.log(`   • Average items: ${(itemCounts.reduce((a: number, b: number) => a + b, 0) / itemCounts.length).toFixed(1)}`);
    console.log(`   • Range: ${range} items`);
  }

  /**
   * Generate detailed data table
   */
  generateDataTable(): void {
    if (!this.reportData) {
      console.error('❌ No report data loaded');
      return;
    }

    const iterations = this.reportData.iterations || [];

    console.log('\n📋 DETAILED DATA TABLE:');
    console.log('='.repeat(80));
    console.log('Iter | Time                     | Items | Videos | Change');
    console.log('-'.repeat(80));

    iterations.forEach((iter: any, index: number) => {
      const time = new Date(iter.timestamp).toLocaleTimeString();
      const change = index > 0 ?
        (iter.itemCount - iterations[index - 1].itemCount) : 0;
      const changeStr = change > 0 ? `+${change}` : change.toString();

      console.log(
        `${`${index + 1}`.padStart(4)  } | ${ 
        time.padEnd(23)  } | ${ 
        `${iter.itemCount}`.padStart(5)  } | ${ 
        `${iter.videoCount}`.padStart(6)  } | ${ 
        changeStr.padStart(6)}`
      );
    });

    console.log('-'.repeat(80));
  }

  /**
   * Generate HTML chart using Chart.js (for web viewing)
   */
  generateHTMLChart(outputPath?: string): void {
    if (!this.reportData) {
      console.error('❌ No report data loaded');
      return;
    }

    const iterations = this.reportData.iterations || [];
    const labels = iterations.map((iter: any, index: number) => `Iter ${index + 1}`);
    const itemData = iterations.map((iter: any) => iter.itemCount);
    const videoData = iterations.map((iter: any) => iter.videoCount);

    const htmlPath = outputPath || path.join(this.outputDir, 'feed-chart.html');

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Feed Monitor Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .chart-container { margin: 20px 0; }
        h1, h2 { color: #333; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Feed Monitor Results</h1>

        <div class="summary">
            <h2>Summary</h2>
            <p><strong>Total Iterations:</strong> ${iterations.length}</p>
            <p><strong>Duration:</strong> ${(this.reportData.summary.totalDuration / 1000).toFixed(1)} seconds</p>
            <p><strong>Average Items:</strong> ${(itemData.reduce((a: number, b: number) => a + b, 0) / itemData.length).toFixed(1)}</p>
            <p><strong>Min Items:</strong> ${Math.min(...itemData)}</p>
            <p><strong>Max Items:</strong> ${Math.max(...itemData)}</p>
        </div>

        <div class="chart-container">
            <h2>Items Over Time</h2>
            <canvas id="itemsChart" width="400" height="200"></canvas>
        </div>

        <div class="chart-container">
            <h2>Videos Over Time</h2>
            <canvas id="videosChart" width="400" height="200"></canvas>
        </div>

        <div class="chart-container">
            <h2>Combined View</h2>
            <canvas id="combinedChart" width="400" height="200"></canvas>
        </div>
    </div>

    <script>
        // Items Chart
        const itemsCtx = document.getElementById('itemsChart').getContext('2d');
        new Chart(itemsCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                    label: 'Total Items',
                    data: ${JSON.stringify(itemData)},
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Videos Chart
        const videosCtx = document.getElementById('videosChart').getContext('2d');
        new Chart(videosCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                    label: 'Video Items',
                    data: ${JSON.stringify(videoData)},
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Combined Chart
        const combinedCtx = document.getElementById('combinedChart').getContext('2d');
        new Chart(combinedCtx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(labels)},
                datasets: [{
                    label: 'Total Items',
                    data: ${JSON.stringify(itemData)},
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }, {
                    label: 'Video Items',
                    data: ${JSON.stringify(videoData)},
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    </script>
</body>
</html>`;

    try {
      // Ensure output directory exists
      const outputDir = path.dirname(htmlPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(htmlPath, html);
      console.log(`\n🌐 HTML chart saved to: ${htmlPath}`);
      console.log(`   Open this file in your web browser to view interactive charts`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error saving HTML chart: ${errorMessage}`);
    }
  }

  /**
   * Generate all chart formats
   */
  generateAllCharts(outputDir?: string): void {
    console.log('\n🎨 Generating charts...');

    const finalOutputDir = outputDir || this.outputDir;

    // ASCII chart
    this.generateASCIIChart();

    // Data table
    this.generateDataTable();

    // HTML chart
    this.generateHTMLChart(path.join(finalOutputDir, 'feed-chart.html'));

    console.log('\n✅ All charts generated successfully!');
  }
}
