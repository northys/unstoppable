import { CheerioCrawler, ProxyConfiguration, Dataset, log } from 'crawlee';
import type { CheerioCrawlingContext } from 'crawlee';
import { CheerioAPI } from 'cheerio';
import { BaseScraper } from '../scrapers/BaseScraper.js';
import { ThomannScraper } from '../scrapers/ThomannScraper.js';
import { Category, CategoryTree } from '../models/Category.js';
import { CategoryExtractionError } from '../utils/errors.js';

export interface CategoryCrawlerOptions {
  scraper: BaseScraper;
  proxyUrls?: string[];
  maxRequestsPerCrawl?: number;
  buildTree?: boolean;
}

export class CategoryCrawler {
  private scraper: BaseScraper;
  private crawler: CheerioCrawler;
  private categories: Map<string, Category> = new Map();

  constructor(options: CategoryCrawlerOptions) {
    this.scraper = options.scraper;

    const proxyConfiguration = options.proxyUrls 
      ? new ProxyConfiguration({ proxyUrls: options.proxyUrls })
      : undefined;

    this.crawler = new CheerioCrawler({
      proxyConfiguration,
      maxRequestsPerCrawl: options.maxRequestsPerCrawl ?? 50,
      maxConcurrency: 5,
      maxRequestRetries: 3,
      requestHandlerTimeoutSecs: 30,
      
      requestHandler: async (context: CheerioCrawlingContext) => {
        const { request, $, log } = context;
        
        log.info(`Processing categories from ${request.url}`);

        try {
          await this.handleCategoryPage($, request.url);
        } catch (error) {
          log.error(`Error processing ${request.url}: ${error}`);
          throw new CategoryExtractionError(
            `Failed to extract categories from ${request.url}`,
            request.url,
            error instanceof Error ? error.message : String(error)
          );
        }
      },

      failedRequestHandler: async ({ request }, error) => {
        log.error(`Request ${request.url} failed after retries: ${error}`);
      },
    });
  }

  private async handleCategoryPage($: CheerioAPI, url: string): Promise<void> {
    if (this.scraper instanceof ThomannScraper) {
      const categories = await this.scraper.scrapeCategoryPage(url, $);
      
      for (const category of categories) {
        this.categories.set(category.code, category);
        log.info(`Found category: ${category.name} (${category.code})`);
      }

      // Follow pagination if exists
      const nextPageLink = $('.pagination .next a').attr('href');
      if (nextPageLink) {
        await this.crawler.addRequests([nextPageLink]);
      }
    }
  }

  async run(startUrls?: string[]): Promise<void> {
    const urls = startUrls || [this.scraper.getBaseUrl()];
    
    await this.crawler.addRequests(urls);
    await this.crawler.run();
    
    const categoriesArray = Array.from(this.categories.values());
    await Dataset.pushData(categoriesArray);
    
    log.info(`Category extraction completed. Found ${categoriesArray.length} categories.`);
  }

  async exportCategories(format: 'json' | 'csv' = 'json'): Promise<void> {
    const dataset = await Dataset.open();
    
    if (format === 'json') {
      await dataset.exportToJSON('categories');
    } else {
      await dataset.exportToCSV('categories');
    }
  }

  buildCategoryTree(): CategoryTree {
    const categoriesArray = Array.from(this.categories.values());
    const root: Category[] = [];
    const categoryMap = new Map<string, Category>();

    // First pass: create a map of all categories
    categoriesArray.forEach(cat => {
      categoryMap.set(cat.code, { ...cat, subcategories: [] });
    });

    // Second pass: build the tree structure
    categoryMap.forEach(cat => {
      if (!cat.parentCategory) {
        root.push(cat);
      } else {
        // Find parent by name or code
        const parent = Array.from(categoryMap.values()).find(
          p => p.name === cat.parentCategory || p.code === cat.parentCategory
        );
        
        if (parent && parent.subcategories) {
          parent.subcategories.push(cat);
        } else {
          // If parent not found, add to root
          root.push(cat);
        }
      }
    });

    return {
      root,
      totalCategories: categoriesArray.length,
    };
  }

  getCategories(): Category[] {
    return Array.from(this.categories.values());
  }

  getCategoryByCode(code: string): Category | undefined {
    return this.categories.get(code);
  }
}