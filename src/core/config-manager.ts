import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { log } from '../logger';
import { ValidationUtils } from '../utils/validation';
import { createFileSystemError } from '../utils/error-handler';
import { APP_CONFIG } from '../config/constants';

export interface AppConfig {
  outputDir: string;
  maxConcurrent: number;
  maxRetryAttempts: number;
  retryBaseDelayMs: number;
  requestTimeoutMs: number;
  logLevel: string;
  logToFile: boolean;
  overwrite: boolean;
  debug: boolean;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private config: AppConfig;

  private constructor() {
    this.configPath = path.join(os.homedir(), '.sora-dl', 'config.json');
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): AppConfig {
    const defaultConfig: AppConfig = {
      outputDir: APP_CONFIG.DEFAULT_OUTPUT_DIR,
      maxConcurrent: APP_CONFIG.DEFAULT_CONCURRENT_DOWNLOADS,
      maxRetryAttempts: APP_CONFIG.MAX_RETRY_ATTEMPTS,
      retryBaseDelayMs: APP_CONFIG.RETRY_BASE_DELAY_MS,
      requestTimeoutMs: APP_CONFIG.REQUEST_TIMEOUT_MS,
      logLevel: 'warn',
      logToFile: false,
      overwrite: false,
      debug: false
    };

    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(defaultConfig);
      return defaultConfig;
    }

    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const userConfig = JSON.parse(configData);

      // Merge with defaults, validating each field
      return {
        outputDir: userConfig.outputDir || defaultConfig.outputDir,
        maxConcurrent: ValidationUtils.validatePositiveInteger(
          userConfig.maxConcurrent ?? defaultConfig.maxConcurrent,
          'maxConcurrent'
        ),
        maxRetryAttempts: ValidationUtils.validatePositiveInteger(
          userConfig.maxRetryAttempts ?? defaultConfig.maxRetryAttempts,
          'maxRetryAttempts'
        ),
        retryBaseDelayMs: ValidationUtils.validatePositiveInteger(
          userConfig.retryBaseDelayMs ?? defaultConfig.retryBaseDelayMs,
          'retryBaseDelayMs'
        ),
        requestTimeoutMs: ValidationUtils.validatePositiveInteger(
          userConfig.requestTimeoutMs ?? defaultConfig.requestTimeoutMs,
          'requestTimeoutMs'
        ),
        logLevel: ValidationUtils.validateEnum(
          userConfig.logLevel ?? defaultConfig.logLevel,
          'logLevel',
          ['error', 'warn', 'info', 'debug', 'trace']
        ),
        logToFile: ValidationUtils.validateBoolean(
          userConfig.logToFile ?? defaultConfig.logToFile,
          'logToFile'
        ),
        overwrite: ValidationUtils.validateBoolean(
          userConfig.overwrite ?? defaultConfig.overwrite,
          'overwrite'
        ),
        debug: ValidationUtils.validateBoolean(
          userConfig.debug ?? defaultConfig.debug,
          'debug'
        )
      };
    } catch (error) {
      log.warn('Failed to load config, using defaults', { error: (error as Error).message });
      return defaultConfig;
    }
  }

  private saveConfig(config: AppConfig): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      log.debug('Config saved', { configPath: this.configPath });
    } catch (error) {
      log.error('Failed to save config', { configPath: this.configPath }, error as Error);
      throw createFileSystemError('Failed to save config file', { configPath: this.configPath, error });
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.saveConfig(this.config);
    log.debug('Config updated', { key, value });
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  update(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
    log.debug('Config updated with multiple values', { updates });
  }

  reset(): void {
    const defaultConfig: AppConfig = {
      outputDir: APP_CONFIG.DEFAULT_OUTPUT_DIR,
      maxConcurrent: APP_CONFIG.DEFAULT_CONCURRENT_DOWNLOADS,
      maxRetryAttempts: APP_CONFIG.MAX_RETRY_ATTEMPTS,
      retryBaseDelayMs: APP_CONFIG.RETRY_BASE_DELAY_MS,
      requestTimeoutMs: APP_CONFIG.REQUEST_TIMEOUT_MS,
      logLevel: 'warn',
      logToFile: false,
      overwrite: false,
      debug: false
    };

    this.config = defaultConfig;
    this.saveConfig(this.config);
    log.info('Config reset to defaults');
  }

  getConfigPath(): string {
    return this.configPath;
  }

  // Alias methods for CLI compatibility
  getConfig(): AppConfig {
    return this.getAll();
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.update(updates);
  }

  resetToDefaults(): void {
    this.reset();
  }
}
