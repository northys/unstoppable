import { describe, test, expect, beforeAll } from '@jest/globals';
import { load } from 'cheerio';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ThomannScraper } from '../scrapers/ThomannScraper.js';
import { validateSubcategory, isValidSubcategory } from '../utils/validation.js';
import { Subcategory } from '../models/Category.js';
import { ValidationError } from '../utils/errors.js';

describe('Subcategory Extraction', () => {
  let scraper: ThomannScraper;
  let djCategoryPageHtml: string;

  beforeAll(() => {
    scraper = new ThomannScraper();
    djCategoryPageHtml = readFileSync(
      join(process.cwd(), 'src', 'tests', 'fixtures', 'thomann-dj-category-page.html'),
      'utf-8'
    );
  });

  describe('extractSubcategories', () => {
    test('should extract all subcategories from DJ category page', async () => {
      const $ = load(djCategoryPageHtml);
      const subcategories = await scraper.extractSubcategories($, 'DJ Equipment', 'DJ');

      expect(subcategories).toHaveLength(5);
      
      // Check first subcategory
      const djSets = subcategories.find(s => s.name === 'DJ Sets');
      expect(djSets).toBeDefined();
      expect(djSets?.url).toContain('/de/complete_dj_sets.html');
      expect(djSets?.imageUrl).toContain('587055.jpg');
      expect(djSets?.imageUrlWebp).toContain('587055.webp');
      expect(djSets?.parentCategory).toBe('DJ Equipment');
      expect(djSets?.parentCategoryCode).toBe('DJ');
      expect(djSets?.productCount).toBe(142);
    });

    test('should extract correct image URLs', async () => {
      const $ = load(djCategoryPageHtml);
      const subcategories = await scraper.extractSubcategories($, 'DJ Equipment', 'DJ');

      subcategories.forEach(sub => {
        expect(sub.imageUrl).toMatch(/https:\/\/thumbs\.static-thomann\.de.*\.jpg/);
        expect(sub.imageUrlWebp).toMatch(/https:\/\/thumbs\.static-thomann\.de.*\.webp/);
      });
    });

    test('should extract product counts', async () => {
      const $ = load(djCategoryPageHtml);
      const subcategories = await scraper.extractSubcategories($, 'DJ Equipment', 'DJ');

      const expectedCounts = [142, 385, 97, 224, 58];
      subcategories.forEach((sub, index) => {
        expect(sub.productCount).toBe(expectedCounts[index]);
      });
    });

    test('should handle parent category information', async () => {
      const $ = load(djCategoryPageHtml);
      const subcategories = await scraper.extractSubcategories($, 'Test Category', 'TC');

      subcategories.forEach(sub => {
        expect(sub.parentCategory).toBe('Test Category');
        expect(sub.parentCategoryCode).toBe('TC');
      });
    });
  });

  describe('Subcategory Validation', () => {
    test('isValidSubcategory should validate correct subcategories', () => {
      const validSubcategory: Subcategory = {
        name: 'DJ Controllers',
        url: 'https://example.com/dj-controllers',
        imageUrl: 'https://example.com/image.jpg',
        imageUrlWebp: 'https://example.com/image.webp',
        parentCategory: 'DJ Equipment',
        parentCategoryCode: 'DJ',
        productCount: 100,
        scrapedAt: new Date(),
        source: 'test',
      };

      expect(isValidSubcategory(validSubcategory)).toBe(true);
    });

    test('isValidSubcategory should reject invalid subcategories', () => {
      expect(isValidSubcategory(null)).toBe(false);
      expect(isValidSubcategory({})).toBe(false);
      expect(isValidSubcategory({ name: 'Test' })).toBe(false);
      expect(isValidSubcategory({
        name: 'Test',
        url: 'https://test.com',
        imageUrl: 'https://test.com/img.jpg',
        parentCategory: '',
        parentCategoryCode: '',
      })).toBe(false);
    });

    test('validateSubcategory should throw on missing fields', () => {
      expect(() => validateSubcategory({})).toThrow(ValidationError);
      expect(() => validateSubcategory({ name: 'Test' })).toThrow(ValidationError);
      expect(() => validateSubcategory({
        name: 'Test',
        url: 'https://test.com',
      })).toThrow(ValidationError);
    });

    test('validateSubcategory should return valid subcategory with defaults', () => {
      const raw = {
        name: '  DJ Controllers  ',
        url: '  https://example.com/dj  ',
        imageUrl: '  https://example.com/img.jpg  ',
        imageUrlWebp: '  https://example.com/img.webp  ',
        parentCategory: '  DJ Equipment  ',
        parentCategoryCode: '  DJ  ',
      };

      const validated = validateSubcategory(raw);
      expect(validated.name).toBe('DJ Controllers');
      expect(validated.url).toBe('https://example.com/dj');
      expect(validated.imageUrl).toBe('https://example.com/img.jpg');
      expect(validated.imageUrlWebp).toBe('https://example.com/img.webp');
      expect(validated.parentCategory).toBe('DJ Equipment');
      expect(validated.parentCategoryCode).toBe('DJ');
      expect(validated.scrapedAt).toBeDefined();
    });
  });

  describe('Expected Subcategory Output', () => {
    test('should match expected subcategory structure', async () => {
      const $ = load(djCategoryPageHtml);
      const subcategories = await scraper.extractSubcategories($, 'DJ Equipment', 'DJ');

      const expectedSubcategories = [
        { name: 'DJ Sets', url: '/de/complete_dj_sets.html', productCount: 142 },
        { name: 'DJ Controllers', url: '/de/dj_controller.html', productCount: 385 },
        { name: 'Turntables', url: '/de/dj_turntables.html', productCount: 97 },
        { name: 'DJ Mixers', url: '/de/dj_mixer.html', productCount: 224 },
        { name: 'DJ CD Players', url: '/de/cd_player_dj.html', productCount: 58 },
      ];

      expectedSubcategories.forEach((expected, index) => {
        const found = subcategories[index];
        expect(found.name).toBe(expected.name);
        expect(found.url).toContain(expected.url);
        expect(found.productCount).toBe(expected.productCount);
      });
    });
  });
});