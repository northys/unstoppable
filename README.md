# Unstoppable - Product Data Scraper

A high-performance, extensible web scraper built with TypeScript and Crawlee for extracting product data from e-commerce websites.

## Features

- **Extensible Architecture**: Easy to add new website scrapers by extending the base scraper class
- **Parallel Processing**: Leverages Crawlee's concurrent crawling capabilities
- **TypeScript**: Full type safety and better development experience
- **Test-Driven**: Comprehensive test suite with HTML snapshots
- **Data Export**: Export scraped data in JSON or CSV formats
- **Proxy Support**: Built-in proxy rotation support

## Project Structure

```
unstoppable/
├── src/
│   ├── crawlers/        # Crawler implementations
│   ├── scrapers/        # Website-specific scrapers
│   ├── models/          # Data models
│   ├── utils/           # Utility functions
│   └── tests/           # Test files and fixtures
├── dist/                # Compiled JavaScript output
└── storage/             # Crawlee data storage
```

## Installation

```bash
npm install
```

## Usage

### Development

```bash
npm start
# or
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

### Testing

```bash
npm test
```

### Linting and Type Checking

```bash
npm run lint
npm run typecheck
```

## Adding a New Website Scraper

1. Create a new scraper class extending `BaseScraper`:

```typescript
import { BaseScraper } from './BaseScraper.js';

export class NewWebsiteScraper extends BaseScraper {
  constructor() {
    super({
      name: 'NewWebsite',
      baseUrl: 'https://example.com',
    });
  }

  // Implement required methods
  async scrapeProductList(url: string): Promise<ScraperResult> { /* ... */ }
  async scrapeProductDetail(url: string): Promise<Product> { /* ... */ }
  async getCategoryUrls(): Promise<string[]> { /* ... */ }
  isProductUrl(url: string): boolean { /* ... */ }
  isCategoryUrl(url: string): boolean { /* ... */ }
}
```

2. Use the scraper with ProductCrawler:

```typescript
import { ProductCrawler } from './crawlers/ProductCrawler.js';
import { NewWebsiteScraper } from './scrapers/NewWebsiteScraper.js';

const scraper = new NewWebsiteScraper();
const crawler = new ProductCrawler({ scraper });
await crawler.run();
```

## Data Model

Products are scraped with the following structure:

```typescript
interface Product {
  id: string;
  sku?: string;
  name: string;
  brand?: string;
  category: string[];
  price: {
    currency: string;
    amount: number;
    originalAmount?: number;
    discount?: number;
  };
  availability: {
    inStock: boolean;
    stockLevel?: number;
    deliveryTime?: string;
  };
  images: string[];
  description?: string;
  specifications?: Record<string, string>;
  ratings?: {
    average: number;
    count: number;
  };
  url: string;
  scrapedAt: Date;
  source: string;
}
```

## Configuration

Configure the crawler behavior through `ProductCrawler` options:

- `maxRequestsPerCrawl`: Limit the number of requests
- `proxyUrls`: Array of proxy URLs for rotation
- `startUrls`: Override default category URLs

## License

ISC