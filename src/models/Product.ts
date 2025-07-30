export interface Product {
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

export interface ScraperResult {
  products: Product[];
  nextPageUrl?: string;
  totalProducts?: number;
  currentPage?: number;
  totalPages?: number;
}