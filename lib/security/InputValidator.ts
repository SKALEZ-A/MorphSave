import { NextRequest } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';

export interface InputValidationConfig {
  enabled: boolean;
  maxBodySize: number;
  sanitizeHtml: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedData?: any;
}

export class InputValidator {
  private config: InputValidationConfig;

  constructor(config: InputValidationConfig) {
    this.config = config;
  }

  /**
   * Validate incoming request
   */
  async validate(request: NextRequest): Promise<ValidationResult> {
    const errors: string[] = [];

    try {
      // 1. Check request size
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > this.config.maxBodySize) {
        errors.push(`Request body too large: ${contentLength} bytes (max: ${this.config.maxBodySize})`);
      }

      // 2. Validate headers
      const headerValidation = this.validateHeaders(request);
      errors.push(...headerValidation.errors);

      // 3. Validate URL and query parameters
      const urlValidation = this.validateUrl(request);
      errors.push(...urlValidation.errors);

      // 4. Validate request body if present
      let sanitizedData;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const bodyValidation = await this.validateBody(request);
        errors.push(...bodyValidation.errors);
        sanitizedData = bodyValidation.sanitizedData;
      }

      return {
        valid: errors.length === 0,
        errors,
        sanitizedData
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate request headers
   */
  private validateHeaders(request: NextRequest): ValidationResult {
    const errors: string[] = [];
    const headers = request.headers;

    // Check for malicious patterns in headers
    const maliciousPatterns = [
      { name: 'SQL Injection', pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)|('|(\\x27)|(\\x2D\\x2D))/i },
      { name: 'XSS', pattern: /<script|javascript:|vbscript:|onload=|onerror=|onclick=/i },
      { name: 'Path Traversal', pattern: /\.\.[\/\\]|\.\.%2f|\.\.%5c/i },
      { name: 'Command Injection', pattern: /[;&|`$(){}[\]]/i },
      { name: 'LDAP Injection', pattern: /[()=*!&|]/i }
    ];

    headers.forEach((value, key) => {
      // Check header value length
      if (value.length > 8192) { // 8KB limit per header
        errors.push(`Header ${key} too long: ${value.length} characters`);
      }

      // Check for malicious patterns
      maliciousPatterns.forEach(({ name, pattern }) => {
        if (pattern.test(value)) {
          errors.push(`${name} pattern detected in header ${key}`);
        }
      });

      // Check for null bytes
      if (value.includes('\0')) {
        errors.push(`Null byte detected in header ${key}`);
      }

      // Validate specific headers
      if (key.toLowerCase() === 'content-type') {
        if (!this.isValidContentType(value)) {
          errors.push(`Invalid content-type: ${value}`);
        }
      }

      if (key.toLowerCase() === 'user-agent') {
        if (!this.isValidUserAgent(value)) {
          errors.push(`Suspicious user-agent: ${value}`);
        }
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate URL and query parameters
   */
  private validateUrl(request: NextRequest): ValidationResult {
    const errors: string[] = [];
    const url = new URL(request.url);

    // Check URL length
    if (request.url.length > 2048) {
      errors.push(`URL too long: ${request.url.length} characters`);
    }

    // Check for malicious patterns in path
    const maliciousPatterns = [
      { name: 'Path Traversal', pattern: /\.\.[\/\\]|\.\.%2f|\.\.%5c/i },
      { name: 'XSS', pattern: /<script|javascript:|vbscript:|onload=|onerror=/i },
      { name: 'SQL Injection', pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)|('|(\\x27))/i }
    ];

    maliciousPatterns.forEach(({ name, pattern }) => {
      if (pattern.test(url.pathname)) {
        errors.push(`${name} pattern detected in URL path`);
      }
    });

    // Validate query parameters
    url.searchParams.forEach((value, key) => {
      // Check parameter length
      if (key.length > 256) {
        errors.push(`Query parameter name too long: ${key}`);
      }
      if (value.length > 4096) {
        errors.push(`Query parameter value too long: ${key}=${value}`);
      }

      // Check for malicious patterns
      maliciousPatterns.forEach(({ name, pattern }) => {
        if (pattern.test(key) || pattern.test(value)) {
          errors.push(`${name} pattern detected in query parameter ${key}`);
        }
      });

      // Check for null bytes
      if (key.includes('\0') || value.includes('\0')) {
        errors.push(`Null byte detected in query parameter ${key}`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate request body
   */
  private async validateBody(request: NextRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    let sanitizedData;

    try {
      const contentType = request.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const bodyValidation = await this.validateJsonBody(request);
        errors.push(...bodyValidation.errors);
        sanitizedData = bodyValidation.sanitizedData;
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const bodyValidation = await this.validateFormBody(request);
        errors.push(...bodyValidation.errors);
        sanitizedData = bodyValidation.sanitizedData;
      } else if (contentType.includes('multipart/form-data')) {
        const bodyValidation = await this.validateMultipartBody(request);
        errors.push(...bodyValidation.errors);
        sanitizedData = bodyValidation.sanitizedData;
      }

    } catch (error) {
      errors.push(`Body validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { valid: errors.length === 0, errors, sanitizedData };
  }

  /**
   * Validate JSON body
   */
  private async validateJsonBody(request: NextRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    let sanitizedData;

    try {
      const body = await request.text();
      
      // Check for malicious patterns in raw JSON
      if (this.containsMaliciousPatterns(body)) {
        errors.push('Malicious patterns detected in JSON body');
      }

      // Parse JSON
      const data = JSON.parse(body);
      
      // Validate and sanitize the parsed data
      const validation = this.validateAndSanitizeObject(data);
      errors.push(...validation.errors);
      sanitizedData = validation.sanitizedData;

    } catch (error) {
      if (error instanceof SyntaxError) {
        errors.push('Invalid JSON format');
      } else {
        errors.push(`JSON validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { valid: errors.length === 0, errors, sanitizedData };
  }

  /**
   * Validate form body
   */
  private async validateFormBody(request: NextRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    let sanitizedData: Record<string, string> = {};

    try {
      const formData = await request.formData();
      
      formData.forEach((value, key) => {
        const stringValue = value.toString();
        
        // Validate field name and value
        if (key.length > 256) {
          errors.push(`Form field name too long: ${key}`);
        }
        if (stringValue.length > 10000) {
          errors.push(`Form field value too long: ${key}`);
        }

        // Check for malicious patterns
        if (this.containsMaliciousPatterns(key) || this.containsMaliciousPatterns(stringValue)) {
          errors.push(`Malicious patterns detected in form field: ${key}`);
        }

        // Sanitize the value
        sanitizedData[key] = this.sanitizeString(stringValue);
      });

    } catch (error) {
      errors.push(`Form validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { valid: errors.length === 0, errors, sanitizedData };
  }

  /**
   * Validate multipart body
   */
  private async validateMultipartBody(request: NextRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    let sanitizedData: Record<string, any> = {};

    try {
      const formData = await request.formData();
      
      formData.forEach((value, key) => {
        if (value instanceof File) {
          // Validate file
          const fileValidation = this.validateFile(value, key);
          errors.push(...fileValidation.errors);
          if (fileValidation.valid) {
            sanitizedData[key] = value;
          }
        } else {
          // Validate text field
          const stringValue = value.toString();
          if (this.containsMaliciousPatterns(key) || this.containsMaliciousPatterns(stringValue)) {
            errors.push(`Malicious patterns detected in multipart field: ${key}`);
          } else {
            sanitizedData[key] = this.sanitizeString(stringValue);
          }
        }
      });

    } catch (error) {
      errors.push(`Multipart validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { valid: errors.length === 0, errors, sanitizedData };
  }

  /**
   * Validate file upload
   */
  private validateFile(file: File, fieldName: string): ValidationResult {
    const errors: string[] = [];

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      errors.push(`File ${fieldName} too large: ${file.size} bytes`);
    }

    // Check file name
    if (file.name.length > 255) {
      errors.push(`File name too long: ${file.name}`);
    }

    // Check for malicious file names
    const maliciousFilePatterns = [
      /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|php|asp|jsp)$/i,
      /\.\./,
      /[<>:"|?*]/
    ];

    maliciousFilePatterns.forEach(pattern => {
      if (pattern.test(file.name)) {
        errors.push(`Suspicious file name: ${file.name}`);
      }
    });

    // Validate MIME type
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
      'application/json', 'application/xml'
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      errors.push(`Unsupported file type: ${file.type}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate and sanitize object recursively
   */
  private validateAndSanitizeObject(obj: any, depth = 0): ValidationResult {
    const errors: string[] = [];
    let sanitizedData: any;

    // Prevent deep nesting attacks
    if (depth > 10) {
      errors.push('Object nesting too deep');
      return { valid: false, errors };
    }

    if (Array.isArray(obj)) {
      // Validate array
      if (obj.length > 1000) {
        errors.push('Array too large');
      }

      sanitizedData = obj.map((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const validation = this.validateAndSanitizeObject(item, depth + 1);
          errors.push(...validation.errors);
          return validation.sanitizedData;
        } else {
          return this.sanitizeValue(item);
        }
      });

    } else if (typeof obj === 'object' && obj !== null) {
      // Validate object
      const keys = Object.keys(obj);
      if (keys.length > 100) {
        errors.push('Object has too many properties');
      }

      sanitizedData = {};
      keys.forEach(key => {
        // Validate key
        if (key.length > 256) {
          errors.push(`Property name too long: ${key}`);
          return;
        }

        if (this.containsMaliciousPatterns(key)) {
          errors.push(`Malicious pattern in property name: ${key}`);
          return;
        }

        // Validate and sanitize value
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
          const validation = this.validateAndSanitizeObject(value, depth + 1);
          errors.push(...validation.errors);
          sanitizedData[key] = validation.sanitizedData;
        } else {
          sanitizedData[key] = this.sanitizeValue(value);
        }
      });

    } else {
      // Primitive value
      sanitizedData = this.sanitizeValue(obj);
    }

    return { valid: errors.length === 0, errors, sanitizedData };
  }

  /**
   * Sanitize a single value
   */
  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    return value;
  }

  /**
   * Sanitize string value
   */
  private sanitizeString(str: string): string {
    if (!this.config.sanitizeHtml) {
      return str;
    }

    // Remove null bytes
    str = str.replace(/\0/g, '');

    // Sanitize HTML if enabled
    if (this.config.sanitizeHtml) {
      str = DOMPurify.sanitize(str, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
      });
    }

    // Limit string length
    if (str.length > 10000) {
      str = str.substring(0, 10000);
    }

    return str;
  }

  /**
   * Check for malicious patterns
   */
  private containsMaliciousPatterns(input: string): boolean {
    const patterns = [
      // SQL Injection
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)|('|(\\x27)|(\\x2D\\x2D))/i,
      
      // XSS
      /<script|javascript:|vbscript:|onload=|onerror=|onclick=|onmouseover=/i,
      
      // Path Traversal
      /\.\.[\/\\]|\.\.%2f|\.\.%5c/i,
      
      // Command Injection
      /[;&|`$(){}[\]]/,
      
      // LDAP Injection
      /[()=*!&|]/,
      
      // NoSQL Injection
      /\$where|\$ne|\$gt|\$lt|\$regex/i,
      
      // XML Injection
      /<!ENTITY|<!DOCTYPE|<\?xml/i
    ];

    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate content type
   */
  private isValidContentType(contentType: string): boolean {
    const validTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain',
      'application/xml',
      'text/xml'
    ];

    return validTypes.some(type => contentType.toLowerCase().includes(type));
  }

  /**
   * Validate user agent
   */
  private isValidUserAgent(userAgent: string): boolean {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /sqlmap|nikto|nmap|masscan|zap|burp/i,
      /bot|crawler|spider/i,
      /<script|javascript:/i
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }
}