import ProgressBar from 'progress';
import { log } from '../logger';

export interface ProgressOptions {
  total: number;
  title?: string;
  format?: string;
  showProgress?: boolean;
}

export class ProgressManager {
  private progressBar: ProgressBar | null = null;
  private current: number = 0;
  private total: number;
  private title: string;
  private showProgress: boolean;

  constructor(options: ProgressOptions) {
    this.total = options.total;
    this.title = options.title || 'Processing';
    this.showProgress = options.showProgress ?? true;

    if (this.showProgress && this.total > 0) {
      const format = options.format || `${this.title} [:bar] :current/:total :percent :etas`;
      this.progressBar = new ProgressBar(format, {
        complete: '█',
        incomplete: '░',
        width: 30,
        total: this.total
      });
    }
  }

  update(increment: number = 1, message?: string): void {
    this.current += increment;

    if (this.progressBar) {
      this.progressBar.tick(increment, { message: message || '' });
    } else if (this.showProgress) {
      const percent = Math.round((this.current / this.total) * 100);
      process.stdout.write(`\r${this.title}: ${this.current}/${this.total} (${percent}%)`);
    }

    log.debug('Progress updated', {
      current: this.current,
      total: this.total,
      percent: Math.round((this.current / this.total) * 100),
      message
    });
  }

  setCurrent(current: number): void {
    const increment = current - this.current;
    this.update(increment);
  }

  complete(message?: string): void {
    if (this.progressBar) {
      this.progressBar.terminate();
    } else if (this.showProgress) {
      console.log(`\n${this.title}: Complete${message ? ` - ${message}` : ''}`);
    }

    log.info('Progress completed', {
      total: this.total,
      completed: this.current,
      message
    });
  }

  getCurrent(): number {
    return this.current;
  }

  getTotal(): number {
    return this.total;
  }

  getPercent(): number {
    return Math.round((this.current / this.total) * 100);
  }

  isComplete(): boolean {
    return this.current >= this.total;
  }
}

export class BatchProgressManager {
  private progressManagers: Map<string, ProgressManager> = new Map();
  private batchId: string;

  constructor(batchId: string) {
    this.batchId = batchId;
  }

  createProgress(operationId: string, options: ProgressOptions): ProgressManager {
    const progress = new ProgressManager(options);
    this.progressManagers.set(operationId, progress);

    log.debug('Progress created for batch operation', {
      batchId: this.batchId,
      operationId,
      total: options.total
    });

    return progress;
  }

  getProgress(operationId: string): ProgressManager | undefined {
    return this.progressManagers.get(operationId);
  }

  completeAll(): void {
    this.progressManagers.forEach((progress, operationId) => {
      progress.complete();
      log.debug('Batch operation completed', {
        batchId: this.batchId,
        operationId
      });
    });
    this.progressManagers.clear();
  }

  getTotalProgress(): { completed: number; total: number; percent: number } {
    let completed = 0;
    let total = 0;

    this.progressManagers.forEach(progress => {
      completed += progress.getCurrent();
      total += progress.getTotal();
    });

    return {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }
}
