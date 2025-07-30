import { CheerioAPI } from 'cheerio';
import { BaseScraper } from './BaseScraper.js';
import { Product, ScraperResult } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { validateCategory } from '../utils/validation.js';

export class ThomannScraper extends BaseScraper {
  constructor() {
    super({
      name: 'Thomann',
      baseUrl: 'https://www.thomann.de',
    });
  }

  async scrapeProductList(_url: string): Promise<ScraperResult> {
    const products: Product[] = [];
    return {
      products,
      nextPageUrl: undefined,
    };
  }

  async scrapeProductDetail(_url: string): Promise<Product> {
    return {} as Product;
  }

  async getCategoryUrls(): Promise<string[]> {
    const mainCategories = [
      '/de/gitarren_und_baesse.html',
      '/de/tasteninstrumente.html',
      '/de/drums_und_percussion.html',
      '/de/software.html',
      '/de/studio_und_recording.html',
      '/de/pa.html',
      '/de/licht.html',
      '/de/dj.html',
      '/de/blasinstrumente.html',
      '/de/streichinstrumente.html',
      '/de/mikrofone.html',
      '/de/kopfhoerer.html',
    ];

    return mainCategories.map(path => `${this.config.baseUrl}${path}`);
  }

  isProductUrl(url: string): boolean {
    return /\/de\/.*\.htm$/.test(url) && !this.isCategoryUrl(url);
  }

  isCategoryUrl(url: string): boolean {
    return /\/de\/.*\.html$/.test(url) || url.includes('/de/cat_');
  }

  parseProductFromList($: CheerioAPI, element: unknown): Partial<Product> {
    const $item = $(element as any);
    
    const name = $item.find('.product-title').text().trim();
    const priceText = $item.find('.product-price').text().trim();
    const productUrl = $item.find('a.product-link').attr('href');
    const imageUrl = $item.find('.product-image img').attr('src');
    
    const price = this.parsePrice(priceText);
    
    return {
      name,
      price,
      url: productUrl ? `${this.config.baseUrl}${productUrl}` : '',
      images: imageUrl ? [imageUrl] : [],
      source: this.config.name,
    };
  }

  parseProductDetail($: CheerioAPI): Product {
    const productId = $('span[itemprop="sku"]').text().trim() || 
                     $('meta[property="product:retailer_item_id"]').attr('content') || '';
    
    const name = $('h1[itemprop="name"]').text().trim() || 
                 $('h1.product-title').text().trim();
    
    const brand = $('span[itemprop="brand"]').text().trim() || 
                  $('meta[property="product:brand"]').attr('content') || '';
    
    const priceText = $('span[itemprop="price"]').attr('content') || 
                      $('.product-price-primary').text().trim();
    
    const price = this.parsePrice(priceText);
    
    const inStock = $('.availability-flag.in-stock').length > 0 || 
                    $('link[itemprop="availability"]').attr('href')?.includes('InStock') || false;
    
    const deliveryTime = $('.delivery-time').text().trim() || 
                         $('.availability-info').text().trim();
    
    const images: string[] = [];
    $('.product-images img, .gallery-image img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src) images.push(src);
    });
    
    const description = $('.product-description').text().trim() || 
                       $('div[itemprop="description"]').text().trim();
    
    const specifications: Record<string, string> = {};
    $('.product-features tr, .specs-table tr').each((_, row) => {
      const key = $(row).find('td:first-child').text().trim();
      const value = $(row).find('td:last-child').text().trim();
      if (key && value) specifications[key] = value;
    });
    
    const ratingAverage = parseFloat($('span[itemprop="ratingValue"]').text()) || 0;
    const ratingCount = parseInt($('span[itemprop="ratingCount"]').text()) || 0;
    
    const categories: string[] = [];
    $('.breadcrumb a, nav[aria-label="breadcrumb"] a').each((_, link) => {
      const text = $(link).text().trim();
      if (text && text !== 'Home') categories.push(text);
    });
    
    return {
      id: productId,
      sku: productId,
      name,
      brand,
      category: categories,
      price,
      availability: {
        inStock,
        deliveryTime,
      },
      images,
      description,
      specifications,
      ratings: ratingAverage > 0 ? {
        average: ratingAverage,
        count: ratingCount,
      } : undefined,
      url: '',
      scrapedAt: new Date(),
      source: this.config.name,
    };
  }

  private parsePrice(priceText: string): Product['price'] {
    const cleanPrice = priceText.replace(/[^\d,.-]/g, '').replace(',', '.');
    const amount = parseFloat(cleanPrice) || 0;
    
    return {
      currency: 'EUR',
      amount,
    };
  }

  extractCategories($: CheerioAPI): Category[] {
    const categories: Category[] = [];
    
    // Extract main categories
    $('.categories-list__item a, .main-menu__item a').each((_, element) => {
      const $el = $(element);
      const href = $el.attr('href');
      const dataCode = $el.attr('data-gtm-key-anja') || $el.attr('data-category-code') || '';
      
      if (!href) return;
      
      const category: Partial<Category> = {
        name: $el.text().trim(),
        url: href.startsWith('http') ? href : `${this.config.baseUrl}${href}`,
        code: dataCode || this.extractCodeFromUrl(href),
        level: 0,
        source: this.config.name,
      };
      
      const validated = validateCategory(category);
      if (validated) {
        categories.push(validated);
      }
    });
    
    // Extract subcategories if present
    $('.subcategories-list__item a, .category-tree__item a').each((_, element) => {
      const $el = $(element);
      const href = $el.attr('href');
      const parentText = $el.closest('.category-group').find('.category-title').text().trim();
      
      if (!href) return;
      
      const category: Partial<Category> = {
        name: $el.text().trim(),
        url: href.startsWith('http') ? href : `${this.config.baseUrl}${href}`,
        code: this.extractCodeFromUrl(href),
        parentCategory: parentText,
        level: 1,
        source: this.config.name,
      };
      
      const validated = validateCategory(category);
      if (validated) {
        categories.push(validated);
      }
    });
    
    return categories;
  }

  private extractCodeFromUrl(url: string): string {
    // Extract category code from URL patterns like /de/GI_guitars.html
    const match = url.match(/\/([A-Z]{2,3})_[\w-]+\.html?$/);
    if (match) return match[1];
    
    // Extract from path segments
    const segments = url.split('/');
    const lastSegment = segments[segments.length - 1];
    const code = lastSegment.replace(/[_.-].*$/, '').toUpperCase();
    
    return code.length <= 3 ? code : '';
  }

  async scrapeCategoryPage(_url: string, $: CheerioAPI): Promise<Category[]> {
    const categories = this.extractCategories($);
    
    // Add product count if available
    categories.forEach(category => {
      const countElement = $(`.category-item[data-url="${category.url}"] .product-count`);
      if (countElement.length) {
        const countText = countElement.text();
        const count = parseInt(countText.replace(/\D/g, ''));
        if (!isNaN(count)) {
          category.productCount = count;
        }
      }
    });
    
    return categories;
  }
}