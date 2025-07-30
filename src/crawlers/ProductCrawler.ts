import { CheerioCrawler, ProxyConfiguration, Dataset, RequestQueue, log } from 'crawlee';
import { BaseScraper } from '../scrapers/BaseScraper.js';
import { Product } from '../models/Product.js';

export interface CrawlerOptions {
  scraper: BaseScraper;
  proxyUrls?: string[];
  maxRequestsPerCrawl?: number;
  startUrls?: string[];
}

export class ProductCrawler {
  private scraper: BaseScraper;
  private crawler: CheerioCrawler;
  private options: CrawlerOptions;

  constructor(options: CrawlerOptions) {
    this.options = options;
    this.scraper = options.scraper;

    const proxyConfiguration = options.proxyUrls 
      ? new ProxyConfiguration({ proxyUrls: options.proxyUrls })
      : undefined;

    this.crawler = new CheerioCrawler({
      proxyConfiguration,
      maxRequestsPerCrawl: options.maxRequestsPerCrawl,
      maxConcurrency: 10,
      maxRequestRetries: 3,
      requestHandlerTimeoutSecs: 60,
      
      async requestHandler({ request, $, enqueueLinks, pushData }) {
        log.info(`Processing ${request.url}`);

        try {
          if (this.scraper.isProductUrl(request.url)) {
            await this.handleProductPage($, request.url, pushData);
          } else if (this.scraper.isCategoryUrl(request.url)) {
            await this.handleCategoryPage($, request.url, enqueueLinks);
          }
        } catch (error) {
          log.error(`Error processing ${request.url}: ${error}`);
          throw error;
        }
      },

      async failedRequestHandler({ request }, error) {
        log.error(`Request ${request.url} failed after retries: ${error}`);
      },
    });
  }

  private async handleProductPage($: any, url: string, pushData: any): Promise<void> {
    const product = this.scraper.parseProductDetail($);
    product.url = url;
    
    await pushData(product);
    log.info(`Scraped product: ${product.name}`);
  }

  private async handleCategoryPage($: any, url: string, enqueueLinks: any): Promise<void> {
    await enqueueLinks({
      selector: 'a',
      transformRequestFunction: (req) => {
        if (this.scraper.isProductUrl(req.url) || this.scraper.isCategoryUrl(req.url)) {
          return req;
        }
        return null;
      },
    });

    const nextPageLink = $('.pagination .next a').attr('href');
    if (nextPageLink) {
      await enqueueLinks({
        urls: [nextPageLink],
      });
    }
  }

  async run(): Promise<void> {
    const startUrls = this.options.startUrls || await this.scraper.getCategoryUrls();
    
    await this.crawler.addRequests(startUrls);
    await this.crawler.run();
    
    const dataset = await Dataset.open();
    const { items } = await dataset.getData();
    
    log.info(`Crawling completed. Scraped ${items.length} products.`);
  }

  async exportData(format: 'json' | 'csv' = 'json'): Promise<void> {
    const dataset = await Dataset.open();
    
    if (format === 'json') {
      await dataset.exportToJSON('products');
    } else {
      await dataset.exportToCSV('products');
    }
  }
}