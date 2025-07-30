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

export interface CategoryTree {
  root: Category[];
  totalCategories: number;
}

export interface CategoryExtractionResult {
  categories: Category[];
  tree?: CategoryTree;
}