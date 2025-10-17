import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface FeedDataItem {
  post?: {
    like_count?: number;
    view_count?: number;
    reply_count?: number;
    remix_count?: number;
    attachments?: Array<{ kind?: string; id?: string }>
  };
  profile?: { user_id?: string };
}

interface FeedDataFile {
  items?: FeedDataItem[];
}

interface ChartDataPoint {
  timestamp: Date;
  postCount: number;
  totalLikes: number;
  totalViews: number;
  totalReplies: number;
  totalRemixes: number;
  uniqueUsers: number;
  soraVideos: number;
  uniqueVideos: number;
}

export class FeedChartGenerator {
  private dataDir: string;
  private outputDir: string;

  constructor(dataDir = './feed-monitor-results', outputDir = './feed-monitor-results') {
    this.dataDir = dataDir;
    this.outputDir = outputDir;
  }

  async loadFeedData(): Promise<ChartDataPoint[]> {
    const pattern = path.join(this.dataDir, 'feed-*.json');
    const files = await glob(pattern);

    const dataPoints: ChartDataPoint[] = [];
    const seenVideoIds = new Set<string>();

    for (const filePath of files.sort()) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data: FeedDataFile = JSON.parse(content);

        const filename = path.basename(filePath);
        const timestamp = this.parseTimestamp(filename);
        if (!timestamp) {
          continue;
        }

        const items = data.items || [];
        const postCount = items.length;
        const totalLikes = items.reduce((sum, item) => sum + (item.post?.like_count || 0), 0);
        const totalViews = items.reduce((sum, item) => sum + (item.post?.view_count || 0), 0);
        const totalReplies = items.reduce((sum, item) => sum + (item.post?.reply_count || 0), 0);
        const totalRemixes = items.reduce((sum, item) => sum + (item.post?.remix_count || 0), 0);
        const uniqueUsers = new Set(items.map(i => i.profile?.user_id)).size;
        const soraVideos = items.reduce((count, item) => count + ((item.post?.attachments || []).filter(att => att.kind === 'sora').length), 0);
        
        // Update cumulative unique videos by extracting video IDs from attachments
        items.forEach(item => {
          (item.post?.attachments || []).forEach(att => {
            if (att.kind === 'sora' && att.id) {
              seenVideoIds.add(att.id);
            }
          });
        });
        const uniqueVideos = seenVideoIds.size;

        dataPoints.push({
          timestamp,
          postCount,
          totalLikes,
          totalViews,
          totalReplies,
          totalRemixes,
          uniqueUsers,
          soraVideos,
          uniqueVideos
        });
      } catch {
        // skip invalid file
      }
    }

    return dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private parseTimestamp(filename: string): Date | null {
    try {
      let timestampStr = filename.replace('feed-', '').replace('.json', '');
      if (timestampStr.endsWith('Z')) {
        timestampStr = timestampStr.slice(0, -1);
        timestampStr = timestampStr.replace('T', ' ');
      }
      if (timestampStr.includes('-') && !timestampStr.includes('T')) {
        const parts = timestampStr.split(' ');
        if (parts.length === 2) {
          const [datePart, timePart] = parts;
          const formattedTime = timePart.replace(/-/g, ':');
          timestampStr = `${datePart} ${formattedTime}`;
        }
      }
      const date = new Date(timestampStr);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch {
      return null;
    }
  }

  private generateHTML(dataPoints: ChartDataPoint[]): string {
    const labels = dataPoints.map(dp => {
      const utc8Time = new Date(dp.timestamp.getTime() + (8 * 60 * 60 * 1000));
      return utc8Time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feed Monitor Charts (UTC+8)</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: #333; margin-bottom: 30px; }
        .chart-container { margin: 30px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
        .chart-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #555; }
        canvas { max-height: 400px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 14px; opacity: 0.9; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Feed Monitor Analytics (UTC+8)</h1>

        <div class="chart-container"><div class="chart-title">Sora Videos & Cumulative Unique Videos</div><canvas id="activityChart"></canvas></div>
    </div>
    <script>
        const labels = ${JSON.stringify(labels)};
        const dataPoints = ${JSON.stringify(dataPoints)};

        const canvas = document.getElementById('activityChart');
        const ctx = canvas.getContext('2d');

        const gradientVideos = ctx.createLinearGradient(0, 0, 0, 400);
        gradientVideos.addColorStop(0, 'rgba(108, 92, 231, 0.35)');
        gradientVideos.addColorStop(1, 'rgba(108, 92, 231, 0.02)');

        const gradientUniqueVideos = ctx.createLinearGradient(0, 0, 0, 400);
        gradientUniqueVideos.addColorStop(0, 'rgba(46, 204, 113, 0.35)');
        gradientUniqueVideos.addColorStop(1, 'rgba(46, 204, 113, 0.02)');

        new Chart(canvas, {
            type: 'line',
            data: {
            labels,
            datasets: [
              {
                label: 'Sora Videos',
                data: dataPoints.map(dp => dp.soraVideos),
                borderColor: '#6c5ce7',
                backgroundColor: gradientVideos,
                pointBackgroundColor: '#6c5ce7',
                pointBorderColor: '#fff',
                pointRadius: 2,
                tension: 0.35,
                fill: true,
              },
              {
                label: 'Cumulative Unique Videos',
                data: dataPoints.map(dp => dp.uniqueVideos),
                borderColor: '#2ecc71',
                backgroundColor: gradientUniqueVideos,
                pointBackgroundColor: '#2ecc71',
                pointBorderColor: '#fff',
                pointRadius: 2,
                tension: 0.35,
                fill: true
              }
            ]
            },
            options: {
                responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: true },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const label = ctx.dataset.label || '';
                    const value = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : 0;
                    return label + ': ' + value.toLocaleString();
                  }
                }
              }
            },
                scales: {
              y: {
                type: 'linear',
                beginAtZero: true,
                grid: { drawOnChartArea: true }
              },
              x: {
                grid: { display: false }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
    return html;
  }

  async generateAllCharts(): Promise<void> {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    const dataPoints = await this.loadFeedData();
    if (dataPoints.length === 0) {
      console.log('No data found. Please check the data directory path.');
      return;
    }
    const html = this.generateHTML(dataPoints);
    const outputPath = path.join(this.outputDir, 'feed-charts.html');
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`\nCharts generated successfully!`);
    console.log(`HTML file saved to: ${outputPath}`);
    console.log(`Open the file in your browser to view the interactive charts.`);
  }
}
