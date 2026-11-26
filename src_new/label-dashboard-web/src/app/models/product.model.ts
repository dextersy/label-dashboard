export interface Product {
  id: number;
  name: string;
  sku?: string | null;
  description?: string | null;
  price?: number | null;
  brand_id: number;
  release_id?: number | null;
  artist_id?: number | null;
  status: 'active' | 'inactive';
  release?: {
    id: number;
    title: string;
    catalog_no?: string;
    cover_art?: string;
  };
  artist?: {
    id: number;
    name: string;
  };
  images?: ProductImage[];
  productArtists?: ProductArtistSplit[];
}

export interface ProductImage {
  id: number;
  product_id: number;
  path: string;
  sort_order: number;
}

export interface ProductArtistSplit {
  artist_id: number;
  product_id: number;
  merch_royalty_percentage: number;
  merch_royalty_type: 'Revenue' | 'Profit';
  artist?: {
    id: number;
    name: string;
  };
}

export interface EarningTarget {
  releases: Array<{
    id: number;
    title: string;
    catalog_no?: string;
    cover_art?: string;
  }>;
  products: Array<{
    id: number;
    name: string;
    sku?: string;
    images?: Array<{ path: string }>;
  }>;
}
