import { VideoItem, SoraFeedResponse, SoraPost, SoraAttachment } from '../types';

export class TypeGuards {
  static isVideoItem(obj: any): obj is VideoItem {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.id === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.videoUrl === 'string'
    );
  }

  static isSoraAttachment(obj: any): obj is SoraAttachment {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.id === 'string' &&
      Array.isArray(obj.tags) &&
      typeof obj.kind === 'string' &&
      typeof obj.generation_id === 'string' &&
      typeof obj.generation_type === 'string' &&
      typeof obj.url === 'string' &&
      typeof obj.downloadable_url === 'string' &&
      typeof obj.width === 'number' &&
      typeof obj.height === 'number'
    );
  }

  static isSoraPost(obj: any): obj is SoraPost {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.id === 'string' &&
      typeof obj.shared_by === 'string' &&
      typeof obj.is_owner === 'boolean' &&
      typeof obj.posted_at === 'number' &&
      typeof obj.updated_at === 'number' &&
      typeof obj.text === 'string' &&
      Array.isArray(obj.attachments)
    );
  }

  static isSoraFeedResponse(obj: any): obj is SoraFeedResponse {
    return (
      obj &&
      typeof obj === 'object' &&
      Array.isArray(obj.items) &&
      obj.items.every((item: any) => 
        item && 
        typeof item === 'object' && 
        this.isSoraPost(item.post)
      )
    );
  }

  static isString(value: any): value is string {
    return typeof value === 'string';
  }

  static isNumber(value: any): value is number {
    return typeof value === 'number' && !isNaN(value);
  }

  static isBoolean(value: any): value is boolean {
    return typeof value === 'boolean';
  }

  static isArray<T>(value: any): value is T[] {
    return Array.isArray(value);
  }

  static isObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  static isFunction(value: any): value is Function {
    return typeof value === 'function';
  }

  static isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
  }

  static isUrl(value: any): value is string {
    if (typeof value !== 'string') return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  static isPositiveNumber(value: any): value is number {
    return this.isNumber(value) && value > 0;
  }

  static isNonEmptyString(value: any): value is string {
    return this.isString(value) && value.length > 0;
  }

  static isNonEmptyArray<T>(value: any): value is T[] {
    return this.isArray<T>(value) && value.length > 0;
  }

  static isError(value: any): value is Error {
    return value instanceof Error;
  }

  static isAxiosError(value: any): value is import('axios').AxiosError {
    return value && typeof value === 'object' && value.isAxiosError === true;
  }
}
