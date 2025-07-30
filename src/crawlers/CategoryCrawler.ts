import { CheerioCrawler, ProxyConfiguration, Dataset, log } from 'crawlee';
import type { CheerioCrawlingContext } from 'crawlee';
import { CheerioAPI } from 'cheerio';
import { BaseScraper } from '../scrapers/BaseScraper.js';
import { ThomannScraper } from '../scrapers/ThomannScraper.js';
import { Category, CategoryTree, Subcategory, CrawlProgress } from '../models/Category.js';
import { CategoryExtractionError } from '../utils/errors.js';

export interface CategoryCrawlerOptions {
  scraper: BaseScraper;
  proxyUrls?: string[];
  maxRequestsPerCrawl?: number;
  buildTree?: boolean;
  extractSubcategories?: boolean;
  onProgress?: (progress: CrawlProgress) => void;
}

export class CategoryCrawler {
  private scraper: BaseScraper;
  private crawler: CheerioCrawler;
  private options: CategoryCrawlerOptions;
  private categories: Map<string, Category> = new Map();
  private subcategories: Map<string, Subcategory[]> = new Map();
  private progress: CrawlProgress = {
    totalCategories: 0,
    processedCategories: 0,
    totalSubcategories: 0,
    failedRequests: [],
  };

  constructor(options: CategoryCrawlerOptions) {
    this.options = options;
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
        const { userData } = request;
        
        log.info(`Processing ${userData?.type || 'main'} page: ${request.url}`);

        try {
          if (!userData?.type || userData.type === 'main') {
            await this.handleMainPage($, request.url, context);
          } else if (userData.type === 'category') {
            await this.handleCategoryPage($, request.url, userData, context);
          }
        } catch (error) {
          log.error(`Error processing ${request.url}: ${error}`);
          this.progress.failedRequests.push(request.url);
          throw new CategoryExtractionError(
            `Failed to extract from ${request.url}`,
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

  private async handleMainPage($: CheerioAPI, _url: string, _context: CheerioCrawlingContext): Promise<void> {
    if (this.scraper instanceof ThomannScraper) {
      const categories = this.scraper.extractCategories($);
      
      for (const category of categories) {
        this.categories.set(category.code, category);
        log.info(`Found category: ${category.name} (${category.code})`);
      }
      
      this.progress.totalCategories = categories.length;
      this.updateProgress();
      
      // Enqueue category pages for subcategory extraction if enabled
      if (this.options.extractSubcategories) {
        for (const category of categories) {
          await this.crawler.addRequests([{
            url: category.url,
            userData: {
              type: 'category',
              parentCategory: category.name,
              parentCode: category.code,
            },
          }]);
        }
      }
    }
  }

  private async handleCategoryPage(
    $: CheerioAPI, 
    _url: string, 
    userData: any,
    _context: CheerioCrawlingContext
  ): Promise<void> {
    if (this.scraper instanceof ThomannScraper) {
      const { parentCategory, parentCode } = userData;
      const subcategories = await this.scraper.extractSubcategories($, parentCategory, parentCode);
      
      if (subcategories.length > 0) {
        this.subcategories.set(parentCode, subcategories);
        this.progress.totalSubcategories += subcategories.length;
        log.info(`Found ${subcategories.length} subcategories in ${parentCategory}`);
        
        for (const sub of subcategories) {
          log.debug(`  - ${sub.name}`);
        }
      }
      
      this.progress.processedCategories++;
      this.updateProgress();
    }
  }

  private updateProgress(): void {
    if (this.options.onProgress) {
      this.options.onProgress(this.progress);
    }
  }

  async run(startUrls?: string[]): Promise<void> {
    const urls = startUrls || [this.scraper.getBaseUrl()];
    
    // Add main page requests
    const requests = urls.map(url => ({
      url,
      userData: { type: 'main' as const },
    }));
    
    await this.crawler.addRequests(requests);
    await this.crawler.run();
    
    // Save categories
    const categoriesArray = Array.from(this.categories.values());
    const categoriesDataset = await Dataset.open('categories');
    await categoriesDataset.pushData(categoriesArray);
    
    // Save subcategories if extracted
    if (this.options.extractSubcategories) {
      const allSubcategories: Subcategory[] = [];
      for (const subs of this.subcategories.values()) {
        allSubcategories.push(...subs);
      }
      
      const subcategoriesDataset = await Dataset.open('subcategories');
      await subcategoriesDataset.pushData(allSubcategories);
      
      log.info(`Extraction completed: ${categoriesArray.length} categories, ${allSubcategories.length} subcategories.`);
    } else {
      log.info(`Category extraction completed. Found ${categoriesArray.length} categories.`);
    }
  }

  async exportCategories(format: 'json' | 'csv' = 'json'): Promise<void> {
    const categoriesDataset = await Dataset.open('categories');
    
    if (format === 'json') {
      await categoriesDataset.exportToJSON('categories');
    } else {
      await categoriesDataset.exportToCSV('categories');
    }
    
    if (this.options.extractSubcategories) {
      const subcategoriesDataset = await Dataset.open('subcategories');
      
      if (format === 'json') {
        await subcategoriesDataset.exportToJSON('subcategories');
      } else {
        await subcategoriesDataset.exportToCSV('subcategories');
      }
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

  getSubcategories(categoryCode: string): Subcategory[] {
    return this.subcategories.get(categoryCode) || [];
  }

  getAllSubcategories(): Subcategory[] {
    const all: Subcategory[] = [];
    for (const subs of this.subcategories.values()) {
      all.push(...subs);
    }
    return all;
  }

  getProgress(): CrawlProgress {
    return { ...this.progress };
  }
}