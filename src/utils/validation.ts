import { Category, Subcategory } from '../models/Category.js';
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

export function isValidSubcategory(sub: unknown): sub is Subcategory {
  if (!sub || typeof sub !== 'object') return false;
  
  const subcategory = sub as Record<string, unknown>;
  
  return (
    typeof subcategory.name === 'string' &&
    typeof subcategory.url === 'string' &&
    typeof subcategory.imageUrl === 'string' &&
    typeof subcategory.parentCategory === 'string' &&
    typeof subcategory.parentCategoryCode === 'string' &&
    subcategory.name.length > 0 &&
    subcategory.url.length > 0 &&
    subcategory.parentCategory.length > 0 &&
    subcategory.parentCategoryCode.length > 0
  );
}

export function validateSubcategory(raw: Partial<Subcategory>): Subcategory {
  if (!raw.name || !raw.url || !raw.parentCategory || !raw.parentCategoryCode) {
    throw new ValidationError(
      'Missing required subcategory fields',
      'name, url, parentCategory, or parentCategoryCode',
      raw
    );
  }

  return {
    name: raw.name.trim(),
    url: raw.url.trim(),
    imageUrl: raw.imageUrl?.trim() || '',
    imageUrlWebp: raw.imageUrlWebp?.trim() || '',
    parentCategory: raw.parentCategory.trim(),
    parentCategoryCode: raw.parentCategoryCode.trim(),
    productCount: raw.productCount,
    scrapedAt: raw.scrapedAt ?? new Date(),
    source: raw.source ?? 'unknown',
  };
}