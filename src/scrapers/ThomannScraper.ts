import { CheerioAPI } from 'cheerio';
import { BaseScraper } from './BaseScraper.js';
import { Product, ScraperResult } from '../models/Product.js';
import { Category, Subcategory } from '../models/Category.js';
import { validateCategory, validateSubcategory } from '../utils/validation.js';

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
    // Remove all non-numeric characters except comma and period
    let cleanPrice = priceText.replace(/[^\d,.-]/g, '');
    // Handle German number format (1.234,56) by removing thousand separators
    cleanPrice = cleanPrice.replace(/\.(?=\d{3})/g, '').replace(',', '.');
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
      
      try {
        const validated = validateCategory(category);
        categories.push(validated);
      } catch (error) {
        // Skip invalid categories
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
      
      try {
        const validated = validateCategory(category);
        categories.push(validated);
      } catch (error) {
        // Skip invalid categories
      }
    });
    
    return categories;
  }

  private extractCodeFromUrl(url: string): string {
    // Extract category code from URL patterns like /de/GI_guitars.html
    const match = url.match(/\/([A-Z]{2,3})_[\w-]+\.html?$/);
    if (match) return match[1];
    
    // Try to extract from the filename
    const filename = url.split('/').pop() || '';
    const cleanName = filename.replace(/\.html?$/, '').replace(/[_-]/g, ' ');
    
    // Generate a code from the first letters of words
    const words = cleanName.split(/\s+/);
    if (words.length >= 2) {
      return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }
    
    // Fallback to first 2-3 characters
    return cleanName.substring(0, 2).toUpperCase() || 'XX';
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

  async extractSubcategories($: CheerioAPI, parentCategory: string, parentCode: string): Promise<Subcategory[]> {
    const subcategories: Subcategory[] = [];
    
    // Extract subcategories from the category grid
    $('.fx-category-grid__item').each((_, el) => {
      const $item = $(el);
      const $link = $item.closest('a');
      const $img = $item.find('img.fx-image');
      const $source = $item.find('source');
      const $title = $item.find('.fx-category-grid__title');
      
      // Get the href from the parent link
      const href = $link.attr('href') || '';
      
      // Extract product count if available
      const countText = $item.find('.fx-category-grid__count').text();
      const productCount = countText ? parseInt(countText.replace(/\D/g, '')) : undefined;
      
      const subcategory: Partial<Subcategory> = {
        name: $title.text().trim(),
        url: href.startsWith('http') ? href : `${this.config.baseUrl}${href}`,
        imageUrl: $img.attr('src') || '',
        imageUrlWebp: $source.attr('srcset') || '',
        parentCategory,
        parentCategoryCode: parentCode,
        productCount,
        source: this.config.name,
      };
      
      try {
        const validated = validateSubcategory(subcategory);
        subcategories.push(validated);
      } catch (error) {
        // Skip invalid subcategories
      }
    });
    
    // Also check for alternative subcategory selectors
    $('.subcategory-item, .category-list__item').each((_, el) => {
      const $item = $(el);
      const $link = $item.find('a').first();
      const $img = $item.find('img').first();
      const name = $link.text().trim() || $item.find('.subcategory-name').text().trim();
      const href = $link.attr('href') || '';
      
      if (!name || !href) return;
      
      // Check if we already have this subcategory
      if (subcategories.some(sub => sub.name === name)) return;
      
      const subcategory: Partial<Subcategory> = {
        name,
        url: href.startsWith('http') ? href : `${this.config.baseUrl}${href}`,
        imageUrl: $img.attr('src') || '',
        imageUrlWebp: '',
        parentCategory,
        parentCategoryCode: parentCode,
        source: this.config.name,
      };
      
      try {
        const validated = validateSubcategory(subcategory);
        subcategories.push(validated);
      } catch (error) {
        // Skip invalid subcategories
      }
    });
    
    return subcategories;
  }

  isMainPage(url: string): boolean {
    return url === this.config.baseUrl || 
           url === `${this.config.baseUrl}/` ||
           url.includes('/index.html');
  }
}