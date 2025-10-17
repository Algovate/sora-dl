import * as fs from 'fs';
import * as path from 'path';
import { log } from '../logger';
import { FILE_CONFIG } from '../config/constants';
import { createFileSystemError } from './error-handler';

export class FileUtils {
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, FILE_CONFIG.MAX_FILENAME_LENGTH);
  }

  static ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        log.logFileOperation('create', dirPath, true);
      } catch (error) {
        log.logFileOperation('create', dirPath, false, error as Error);
        throw createFileSystemError(`Failed to create directory: ${dirPath}`, { dirPath, error });
      }
    } else {
      log.debug('Directory already exists', { dirPath });
    }
  }

  static ensureDirectoriesExist(dirPaths: string[]): void {
    dirPaths.forEach(dirPath => this.ensureDirectoryExists(dirPath));
  }

  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  static readFile(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      log.logFileOperation('read', filePath, true);
      return content;
    } catch (error) {
      log.logFileOperation('read', filePath, false, error as Error);
      throw createFileSystemError(`Failed to read file: ${filePath}`, { filePath, error });
    }
  }

  static writeFile(filePath: string, content: string): void {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      log.logFileOperation('write', filePath, true);
    } catch (error) {
      log.logFileOperation('write', filePath, false, error as Error);
      throw createFileSystemError(`Failed to write file: ${filePath}`, { filePath, error });
    }
  }

  static writeJSONFile(filePath: string, data: any, pretty: boolean = true): void {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    this.writeFile(filePath, content);
  }

  static deleteFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        log.logFileOperation('delete', filePath, true);
      }
    } catch (error) {
      log.logFileOperation('delete', filePath, false, error as Error);
      throw createFileSystemError(`Failed to delete file: ${filePath}`, { filePath, error });
    }
  }

  static getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      log.warn('Failed to get file size', { filePath, error: (error as Error).message });
      return 0;
    }
  }

  static getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  static getFileNameWithoutExtension(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  static joinPaths(...paths: string[]): string {
    return path.join(...paths);
  }

  static resolvePath(filePath: string): string {
    return path.resolve(filePath);
  }

  static getDirectoryName(filePath: string): string {
    return path.dirname(filePath);
  }

  static getBaseName(filePath: string): string {
    return path.basename(filePath);
  }

  static isAbsolutePath(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  static normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }

  static getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  static listFiles(directory: string, pattern?: RegExp): string[] {
    try {
      const files = fs.readdirSync(directory);
      if (pattern) {
        return files.filter(file => pattern.test(file));
      }
      return files;
    } catch (error) {
      log.warn('Failed to list files', { directory, error: (error as Error).message });
      return [];
    }
  }

  static createWriteStream(filePath: string): fs.WriteStream {
    try {
      const stream = fs.createWriteStream(filePath);
      log.debug('Created write stream', { filePath });
      return stream;
    } catch (error) {
      log.error('Failed to create write stream', { filePath }, error as Error);
      throw createFileSystemError(`Failed to create write stream: ${filePath}`, { filePath, error });
    }
  }

  static createReadStream(filePath: string): fs.ReadStream {
    try {
      const stream = fs.createReadStream(filePath);
      log.debug('Created read stream', { filePath });
      return stream;
    } catch (error) {
      log.error('Failed to create read stream', { filePath }, error as Error);
      throw createFileSystemError(`Failed to create read stream: ${filePath}`, { filePath, error });
    }
  }
}
