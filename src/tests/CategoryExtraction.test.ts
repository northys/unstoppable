import { describe, test, expect, beforeAll } from '@jest/globals';
import { load } from 'cheerio';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ThomannScraper } from '../scrapers/ThomannScraper.js';
import { validateCategory, isValidCategory, sanitizeCategory } from '../utils/validation.js';
import { Category } from '../models/Category.js';
import { ValidationError } from '../utils/errors.js';

describe('Category Extraction', () => {
  let scraper: ThomannScraper;
  let categoriesPageHtml: string;

  beforeAll(() => {
    scraper = new ThomannScraper();
    categoriesPageHtml = readFileSync(
      join(process.cwd(), 'src', 'tests', 'fixtures', 'thomann-categories-page.html'),
      'utf-8'
    );
  });

  describe('extractCategories', () => {
    test('should extract main categories with correct properties', () => {
      const $ = load(categoriesPageHtml);
      const categories = scraper.extractCategories($);

      expect(categories.length).toBeGreaterThan(0);
      
      // Check main categories
      const guitCategory = categories.find(c => c.code === 'GI');
      expect(guitCategory).toBeDefined();
      expect(guitCategory?.name).toBe('Guit/Bass');
      expect(guitCategory?.url).toContain('/de/gitarren_und_baesse.html');
      expect(guitCategory?.level).toBe(0);
      
      const drumsCategory = categories.find(c => c.code === 'DR');
      expect(drumsCategory).toBeDefined();
      expect(drumsCategory?.name).toBe('Drums');
      expect(drumsCategory?.url).toContain('/de/drums_und_percussion.html');
    });

    test('should extract subcategories with parent information', () => {
      const $ = load(categoriesPageHtml);
      const categories = scraper.extractCategories($);

      const subcategories = categories.filter(c => c.level === 1);
      expect(subcategories.length).toBeGreaterThan(0);
      
      const eGuitars = subcategories.find(c => c.name === 'E-Gitarren');
      expect(eGuitars).toBeDefined();
      expect(eGuitars?.parentCategory).toBe('Gitarren & Bässe');
      expect(eGuitars?.level).toBe(1);
    });

    test('should handle categories without explicit codes', () => {
      const $ = load(categoriesPageHtml);
      const categories = scraper.extractCategories($);

      const subcategory = categories.find(c => c.name === 'E-Gitarren');
      expect(subcategory).toBeDefined();
      expect(subcategory?.code).toBeTruthy();
    });
  });

  describe('Category Validation', () => {
    test('isValidCategory should validate correct categories', () => {
      const validCategory: Category = {
        name: 'Test Category',
        url: 'https://example.com/test',
        code: 'TC',
        level: 0,
        scrapedAt: new Date(),
        source: 'test',
      };

      expect(isValidCategory(validCategory)).toBe(true);
    });

    test('isValidCategory should reject invalid categories', () => {
      expect(isValidCategory(null)).toBe(false);
      expect(isValidCategory(undefined)).toBe(false);
      expect(isValidCategory({})).toBe(false);
      expect(isValidCategory({ name: 'Test' })).toBe(false);
      expect(isValidCategory({ name: '', url: '', code: '' })).toBe(false);
    });

    test('validateCategory should throw on missing fields', () => {
      expect(() => validateCategory({})).toThrow(ValidationError);
      expect(() => validateCategory({ name: 'Test' })).toThrow(ValidationError);
      expect(() => validateCategory({ name: 'Test', url: '' })).toThrow(ValidationError);
    });

    test('validateCategory should return valid category with defaults', () => {
      const raw = {
        name: '  Test Category  ',
        url: '  https://example.com  ',
        code: '  TC  ',
      };

      const validated = validateCategory(raw);
      expect(validated.name).toBe('Test Category');
      expect(validated.url).toBe('https://example.com');
      expect(validated.code).toBe('TC');
      expect(validated.level).toBe(0);
      expect(validated.scrapedAt).toBeDefined();
    });

    test('sanitizeCategory should return null for invalid data', () => {
      expect(sanitizeCategory({})).toBeNull();
      expect(sanitizeCategory({ name: 'Test' })).toBeNull();
    });

    test('sanitizeCategory should return valid category for valid data', () => {
      const raw = {
        name: 'Test',
        url: 'https://example.com',
        code: 'TC',
      };

      const sanitized = sanitizeCategory(raw);
      expect(sanitized).not.toBeNull();
      expect(sanitized?.name).toBe('Test');
    });
  });

  describe('extractCodeFromUrl', () => {
    test('should extract code from URL patterns', () => {
      const testCases = [
        { url: '/de/GI_guitars.html', expected: 'GI' },
        { url: '/de/DR_drums_and_percussion.html', expected: 'DR' },
        { url: '/de/TA_keys.html', expected: 'TA' },
        { url: '/de/some_category.html', expected: 'SC' },
      ];

      testCases.forEach(({ url, expected }) => {
        const code = scraper['extractCodeFromUrl'](url);
        expect(code).toBe(expected);
      });
    });
  });

  describe('Expected Category Output', () => {
    test('should match expected category structure', () => {
      const $ = load(categoriesPageHtml);
      const categories = scraper.extractCategories($);

      const expectedCategories = [
        { name: 'Guit/Bass', code: 'GI' },
        { name: 'Drums', code: 'DR' },
        { name: 'Keys', code: 'TA' },
        { name: 'Studio', code: 'ST' },
        { name: 'Software', code: 'SW' },
        { name: 'PA', code: 'PA' },
        { name: 'Lighting', code: 'LI' },
        { name: 'DJ', code: 'DJ' },
      ];

      expectedCategories.forEach(expected => {
        const found = categories.find(c => c.code === expected.code);
        expect(found).toBeDefined();
        expect(found?.name).toBe(expected.name);
      });
    });
  });
});