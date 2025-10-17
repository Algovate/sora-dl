import { createValidationError } from '../common/error-handler';
import { TypeGuards } from '../common/type-guards';

export class ValidationUtils {
  static validateRequired(value: any, fieldName: string): void {
    if (value === undefined || value === null || value === '') {
      throw createValidationError(`${fieldName} is required`, { fieldName, value });
    }
  }

  static validateString(value: any, fieldName: string, minLength?: number, maxLength?: number): string {
    if (typeof value !== 'string') {
      throw createValidationError(`${fieldName} must be a string`, { fieldName, value, type: typeof value });
    }

    if (minLength !== undefined && value.length < minLength) {
      throw createValidationError(`${fieldName} must be at least ${minLength} characters long`, { 
        fieldName, 
        value, 
        minLength, 
        actualLength: value.length 
      });
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw createValidationError(`${fieldName} must be no more than ${maxLength} characters long`, { 
        fieldName, 
        value, 
        maxLength, 
        actualLength: value.length 
      });
    }

    return value;
  }

  static validateNumber(value: any, fieldName: string, min?: number, max?: number): number {
    const num = Number(value);
    if (isNaN(num)) {
      throw createValidationError(`${fieldName} must be a valid number`, { fieldName, value });
    }

    if (min !== undefined && num < min) {
      throw createValidationError(`${fieldName} must be at least ${min}`, { fieldName, value, min, actual: num });
    }

    if (max !== undefined && num > max) {
      throw createValidationError(`${fieldName} must be no more than ${max}`, { fieldName, value, max, actual: num });
    }

    return num;
  }

  static validateUrl(value: any, fieldName: string): string {
    const url = this.validateString(value, fieldName);
    
    try {
      new URL(url);
      return url;
    } catch {
      throw createValidationError(`${fieldName} must be a valid URL`, { fieldName, value });
    }
  }

  static validateFileExists(filePath: string, fieldName: string = 'file'): string {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw createValidationError(`${fieldName} does not exist`, { fieldName, filePath });
    }
    return filePath;
  }

  static validateDirectoryExists(dirPath: string, fieldName: string = 'directory'): string {
    const fs = require('fs');
    if (!fs.existsSync(dirPath)) {
      throw createValidationError(`${fieldName} does not exist`, { fieldName, dirPath });
    }
    
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      throw createValidationError(`${fieldName} is not a directory`, { fieldName, dirPath });
    }
    
    return dirPath;
  }

  static validateArray<T>(value: any, fieldName: string, minLength?: number): T[] {
    if (!Array.isArray(value)) {
      throw createValidationError(`${fieldName} must be an array`, { fieldName, value, type: typeof value });
    }

    if (minLength !== undefined && value.length < minLength) {
      throw createValidationError(`${fieldName} must have at least ${minLength} items`, { 
        fieldName, 
        value, 
        minLength, 
        actualLength: value.length 
      });
    }

    return value;
  }

  static validateObject(value: any, fieldName: string, requiredKeys?: string[]): Record<string, any> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw createValidationError(`${fieldName} must be an object`, { fieldName, value, type: typeof value });
    }

    if (requiredKeys) {
      for (const key of requiredKeys) {
        if (!(key in value)) {
          throw createValidationError(`${fieldName} must have required key: ${key}`, { 
            fieldName, 
            value, 
            requiredKeys, 
            missingKey: key 
          });
        }
      }
    }

    return value;
  }

  static validateEnum<T extends string>(value: any, fieldName: string, allowedValues: T[]): T {
    if (!allowedValues.includes(value)) {
      throw createValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`, { 
        fieldName, 
        value, 
        allowedValues 
      });
    }
    return value;
  }

  static validatePositiveInteger(value: any, fieldName: string): number {
    const num = this.validateNumber(value, fieldName, 1);
    if (!Number.isInteger(num)) {
      throw createValidationError(`${fieldName} must be an integer`, { fieldName, value, actual: num });
    }
    return num;
  }

  static validateBoolean(value: any, fieldName: string): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
        return true;
      }
      if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
        return false;
      }
    }
    
    throw createValidationError(`${fieldName} must be a boolean`, { fieldName, value, type: typeof value });
  }

  static isVideoItem(value: any): boolean {
    return TypeGuards.isVideoItem(value);
  }
}
