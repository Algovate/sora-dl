export class FormatUtils {
  static formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
  }

  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  static formatPercentage(part: number, total: number): string {
    if (total === 0) return '0%';
    return `${Math.round((part / total) * 100)}%`;
  }

  static formatSpeed(bytesPerSecond: number): string {
    return `${this.formatBytes(bytesPerSecond)}/s`;
  }

  static formatETA(remainingBytes: number, bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '∞';
    const remainingSeconds = remainingBytes / bytesPerSecond;
    return this.formatDuration(remainingSeconds * 1000);
  }

  static truncateString(str: string, maxLength: number, suffix: string = '...'): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  }

  static formatTimestamp(timestamp: number | Date): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    return date.toISOString();
  }

  static formatRelativeTime(timestamp: number | Date): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 60000) return 'just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  }

  static formatNumber(num: number): string {
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
    return `${(num / 1000000000).toFixed(1)}B`;
  }

  static formatFileSize(bytes: number): string {
    return this.formatBytes(bytes);
  }

  static formatProgress(current: number, total: number): string {
    const percentage = this.formatPercentage(current, total);
    const progress = Math.round((current / total) * 20); // 20 character bar
    const bar = '='.repeat(progress) + ' '.repeat(20 - progress);
    return `[${bar}] ${percentage}`;
  }
}
