import { Product, ScraperResult } from '../models/Product.js';

export interface ScraperConfig {
  name: string;
  baseUrl: string;
  maxConcurrency?: number;
  maxRequestsPerMinute?: number;
  maxRetries?: number;
  timeout?: number;
}

export abstract class BaseScraper {
  protected config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = {
      maxConcurrency: 10,
      maxRequestsPerMinute: 120,
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };
  }

  abstract scrapeProductList(url: string): Promise<ScraperResult>;
  abstract scrapeProductDetail(url: string): Promise<Product>;
  abstract getCategoryUrls(): Promise<string[]>;
  abstract isProductUrl(url: string): boolean;
  abstract isCategoryUrl(url: string): boolean;

  getName(): string {
    return this.config.name;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}