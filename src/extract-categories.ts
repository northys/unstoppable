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
  .option('-m, --max <number>', 'Maximum requests per crawl', '50')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .parse(process.argv);

const options = program.opts<{
  url?: string;
  format?: 'json' | 'csv';
  tree?: boolean;
  max?: string;
  verbose?: boolean;
}>();

async function main() {
  log.setLevel(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);
  log.info('Starting category extraction...');

  const scraper = new ThomannScraper();
  const crawler = new CategoryCrawler({
    scraper,
    maxRequestsPerCrawl: parseInt(options.max ?? '50'),
    buildTree: options.tree,
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
    log.info('Category extraction completed!');
    log.info(`Total categories found: ${categories.length}`);
    
    // Show sample output
    log.info('Sample categories:');
    categories.slice(0, 5).forEach(cat => {
      log.info(`  - ${cat.name} (${cat.code}) - Level: ${cat.level}`);
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