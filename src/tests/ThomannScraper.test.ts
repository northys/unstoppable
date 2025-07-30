import { describe, test, expect, beforeAll } from '@jest/globals';
import { load } from 'cheerio';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ThomannScraper } from '../scrapers/ThomannScraper.js';

describe('ThomannScraper', () => {
  let scraper: ThomannScraper;
  let productPageHtml: string;
  let categoryPageHtml: string;

  beforeAll(() => {
    scraper = new ThomannScraper();
    productPageHtml = readFileSync(join(process.cwd(), 'src', 'tests', 'fixtures', 'thomann-product-page.html'), 'utf-8');
    categoryPageHtml = readFileSync(join(process.cwd(), 'src', 'tests', 'fixtures', 'thomann-category-page.html'), 'utf-8');
  });

  describe('URL detection', () => {
    test('should identify product URLs correctly', () => {
      expect(scraper.isProductUrl('https://www.thomann.de/de/fender_player_stratocaster.htm')).toBe(true);
      expect(scraper.isProductUrl('https://www.thomann.de/de/product_123.htm')).toBe(true);
      expect(scraper.isProductUrl('https://www.thomann.de/de/e_gitarren.html')).toBe(false);
      expect(scraper.isProductUrl('https://www.thomann.de/de/cat_GF_guitars.html')).toBe(false);
    });

    test('should identify category URLs correctly', () => {
      expect(scraper.isCategoryUrl('https://www.thomann.de/de/e_gitarren.html')).toBe(true);
      expect(scraper.isCategoryUrl('https://www.thomann.de/de/cat_GF_guitars.html')).toBe(true);
      expect(scraper.isCategoryUrl('https://www.thomann.de/de/fender_player.htm')).toBe(false);
    });
  });

  describe('parseProductDetail', () => {
    test('should parse product details from HTML snapshot', () => {
      const $ = load(productPageHtml);
      const product = scraper.parseProductDetail($);

      expect(product.id).toBe('512345');
      expect(product.sku).toBe('512345');
      expect(product.name).toBe('Fender Player Stratocaster MN TPL');
      expect(product.brand).toBe('Fender');
      expect(product.price.currency).toBe('EUR');
      expect(product.price.amount).toBe(739);
      expect(product.availability.inStock).toBe(true);
      expect(product.availability.deliveryTime).toBe('Sofort lieferbar');
      expect(product.images).toHaveLength(2);
      expect(product.images[0]).toContain('17851234_800.jpg');
      expect(product.description).toContain('moderne Interpretation');
      expect(product.specifications?.['Korpus']).toBe('Erle');
      expect(product.specifications?.['Hals']).toBe('Ahorn');
      expect(product.specifications?.['Anzahl Bünde']).toBe('22');
      expect(product.ratings?.average).toBe(4.5);
      expect(product.ratings?.count).toBe(123);
      expect(product.category).toEqual(['Gitarren & Bässe', 'E-Gitarren', 'ST-Modelle']);
    });
  });

  describe('parseProductFromList', () => {
    test('should parse products from category page', () => {
      const $ = load(categoryPageHtml);
      const productElements = $('.product-item');
      
      const firstProduct = scraper.parseProductFromList($, productElements[0]);
      
      expect(firstProduct.name).toBe('Fender Player Stratocaster MN TPL');
      expect(firstProduct.price?.amount).toBe(739);
      expect(firstProduct.url).toBe('https://www.thomann.de/de/fender_player_stratocaster_mn_tpl.htm');
      expect(firstProduct.images?.[0]).toContain('17851234_400.jpg');
      
      const secondProduct = scraper.parseProductFromList($, productElements[1]);
      
      expect(secondProduct.name).toBe('Gibson Les Paul Standard 50s HB');
      expect(secondProduct.price?.amount).toBe(2399);
      expect(secondProduct.url).toBe('https://www.thomann.de/de/gibson_les_paul_standard_50s_hb.htm');
    });
  });

  describe('getCategoryUrls', () => {
    test('should return main category URLs', async () => {
      const urls = await scraper.getCategoryUrls();
      
      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0]).toContain('https://www.thomann.de/de/');
      expect(urls.some(url => url.includes('gitarren_und_baesse'))).toBe(true);
      expect(urls.some(url => url.includes('tasteninstrumente'))).toBe(true);
    });
  });

  describe('price parsing', () => {
    test('should parse various price formats', () => {
      const testCases = [
        { input: '739 €', expected: 739 },
        { input: '2.399 €', expected: 2399 },
        { input: '1.234,56 €', expected: 1234.56 },
        { input: 'EUR 99.99', expected: 99.99 },
        { input: '€ 49', expected: 49 },
      ];

      testCases.forEach(({ input, expected }) => {
        const price = scraper['parsePrice'](input);
        expect(price.amount).toBe(expected);
        expect(price.currency).toBe('EUR');
      });
    });
  });
});