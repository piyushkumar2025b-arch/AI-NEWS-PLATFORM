import { isValidHttpUrl } from '../utils/urls.js';

export class ValidationPipeline {
  validate(item: any): { valid: boolean; reason?: string } {
    if (!item || typeof item !== 'object') {
      return { valid: false, reason: 'Payload must be an object' };
    }

    if (!item.title || typeof item.title !== 'string' || item.title.trim().length < 3) {
      return { valid: false, reason: 'Title must be at least 3 characters long' };
    }

    // Reject non-editorial package release strings (e.g., "django-letter 0.2.0", "pytrilogy 0.3.359")
    if (/^[a-zA-Z0-9_\-\.]+\s+\d+\.\d+(\.\d+)?([a-z0-9\-\.]+)?$/i.test(item.title.trim())) {
      return { valid: false, reason: 'Rejected raw package version string; editorial news required' };
    }

    if (!item.url || typeof item.url !== 'string' || !isValidHttpUrl(item.url)) {
      return { valid: false, reason: 'URL must be a valid http or https URL' };
    }

    if (!item.sourceId && !item.source_id) {
      return { valid: false, reason: 'sourceId is required' };
    }

    return { valid: true };
  }
}

export const validationPipeline = new ValidationPipeline();
