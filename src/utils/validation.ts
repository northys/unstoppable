import { Category } from '../models/Category.js';
import { ValidationError } from './errors.js';

export function isValidCategory(cat: unknown): cat is Category {
  if (!cat || typeof cat !== 'object') return false;
  
  const category = cat as Record<string, unknown>;
  
  return (
    typeof category.name === 'string' &&
    typeof category.url === 'string' &&
    typeof category.code === 'string' &&
    typeof category.level === 'number' &&
    category.name.length > 0 &&
    category.url.length > 0 &&
    category.code.length > 0
  );
}

export function validateCategory(raw: Partial<Category>): Category {
  if (!raw.name || !raw.url || !raw.code) {
    throw new ValidationError(
      'Missing required category fields',
      'name, url, or code',
      raw
    );
  }

  return {
    name: raw.name.trim(),
    url: raw.url.trim(),
    code: raw.code.trim(),
    parentCategory: raw.parentCategory?.trim(),
    level: raw.level ?? 0,
    productCount: raw.productCount,
    subcategories: raw.subcategories,
    scrapedAt: raw.scrapedAt ?? new Date(),
    source: raw.source ?? 'unknown',
  };
}

export function sanitizeCategory(raw: Partial<Category>): Category | null {
  try {
    return validateCategory(raw);
  } catch {
    return null;
  }
}