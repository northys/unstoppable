import { log, LogLevel } from 'crawlee';
import { ProductCrawler } from './crawlers/ProductCrawler.js';
import { ThomannScraper } from './scrapers/ThomannScraper.js';

async function main() {
  log.setLevel(LogLevel.INFO);
  log.info('Starting unstoppable product scraper...');

  const scraper = new ThomannScraper();
  const crawler = new ProductCrawler({
    scraper,
    maxRequestsPerCrawl: 100,
  });

  try {
    await crawler.run();
    await crawler.exportData('json');
    log.info('Scraping completed successfully!');
  } catch (error) {
    log.error('Scraping failed:', error as Error);
    process.exit(1);
  }
}

main().catch((error) => {
  log.error('Unhandled error:', error);
  process.exit(1);
});