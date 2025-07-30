import { log, LogLevel } from 'crawlee';
import { Command } from 'commander';
import { CategoryCrawler } from './crawlers/CategoryCrawler.js';
import { ThomannScraper } from './scrapers/ThomannScraper.js';

const program = new Command();

program
  .name('extract-categories')
  .description('Extract category information from e-commerce websites')
  .option('-u, --url <url>', 'URL to scrape categories from')
  .option('-f, --format <format>', 'Output format (json|csv)', 'json')
  .option('-t, --tree', 'Build category tree structure', false)
  .option('-s, --subcategories', 'Extract subcategories from each category page', false)
  .option('--categories-only', 'Only extract main categories', false)
  .option('--subcategories-only', 'Only extract subcategories (requires existing categories)', false)
  .option('-m, --max <number>', 'Maximum requests per crawl', '50')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('--progress', 'Show extraction progress', false)
  .parse(process.argv);

const options = program.opts<{
  url?: string;
  format?: 'json' | 'csv';
  tree?: boolean;
  subcategories?: boolean;
  categoriesOnly?: boolean;
  subcategoriesOnly?: boolean;
  max?: string;
  verbose?: boolean;
  progress?: boolean;
}>();

async function main() {
  log.setLevel(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);
  log.info('Starting category extraction...');

  // Validate options
  if (options.categoriesOnly && options.subcategoriesOnly) {
    log.error('Cannot use both --categories-only and --subcategories-only');
    process.exit(1);
  }

  const shouldExtractSubcategories = 
    options.subcategories || (!options.categoriesOnly && !options.subcategoriesOnly);

  const scraper = new ThomannScraper();
  const crawler = new CategoryCrawler({
    scraper,
    maxRequestsPerCrawl: parseInt(options.max ?? '50'),
    buildTree: options.tree,
    extractSubcategories: shouldExtractSubcategories,
    onProgress: options.progress ? (progress) => {
      log.info(`Progress: ${progress.processedCategories}/${progress.totalCategories} categories, ${progress.totalSubcategories} subcategories`);
    } : undefined,
  });

  try {
    const startUrls = options.url ? [options.url] : undefined;
    await crawler.run(startUrls);
    
    if (options.tree) {
      const tree = crawler.buildCategoryTree();
      log.info(`Built category tree with ${tree.totalCategories} categories`);
      log.info(`Root categories: ${tree.root.map(c => c.name).join(', ')}`);
    }
    
    await crawler.exportCategories(options.format as 'json' | 'csv');
    
    // Display summary
    const categories = crawler.getCategories();
    const subcategories = crawler.getAllSubcategories();
    const progress = crawler.getProgress();
    
    log.info('Extraction completed!');
    log.info(`Total categories found: ${categories.length}`);
    
    if (shouldExtractSubcategories) {
      log.info(`Total subcategories found: ${subcategories.length}`);
      if (progress.failedRequests.length > 0) {
        log.warning(`Failed requests: ${progress.failedRequests.length}`);
      }
    }
    
    // Show sample output
    log.info('Sample categories:');
    categories.slice(0, 5).forEach(cat => {
      log.info(`  - ${cat.name} (${cat.code}) - Level: ${cat.level}`);
      
      if (shouldExtractSubcategories) {
        const subs = crawler.getSubcategories(cat.code);
        if (subs.length > 0) {
          log.info(`    Subcategories: ${subs.slice(0, 3).map(s => s.name).join(', ')}${subs.length > 3 ? '...' : ''}`);
        }
      }
    });
    
  } catch (error) {
    log.error('Category extraction failed:', error as Error);
    process.exit(1);
  }
}

main().catch((error) => {
  log.error('Unhandled error:', error);
  process.exit(1);
});