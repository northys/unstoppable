export interface Category {
  name: string;
  url: string;
  code: string;
  parentCategory?: string;
  level: number;
  productCount?: number;
  subcategories?: Category[];
  scrapedAt: Date;
  source: string;
}

export interface Subcategory {
  name: string;
  url: string;
  imageUrl: string;
  imageUrlWebp: string;
  parentCategory: string;
  parentCategoryCode: string;
  productCount?: number;
  scrapedAt: Date;
  source: string;
}

export interface CategoryTree {
  root: Category[];
  totalCategories: number;
}

export interface CategoryExtractionResult {
  categories: Category[];
  subcategories?: Subcategory[];
  tree?: CategoryTree;
}

export interface CrawlRequest {
  url: string;
  userData: {
    type: 'main' | 'category' | 'products';
    parentCategory?: string;
    parentCode?: string;
    subcategory?: string;
  };
}

export interface CrawlProgress {
  totalCategories: number;
  processedCategories: number;
  totalSubcategories: number;
  failedRequests: string[];
}