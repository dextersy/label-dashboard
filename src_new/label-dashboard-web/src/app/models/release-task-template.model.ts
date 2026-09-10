export interface ReleaseTaskTemplateItem {
  id: number;
  template_id: number;
  title: string;
  notes: string | null;
  days_before_release: number | null;
  sort_order: number;
}

export interface ReleaseTaskTemplate {
  id: number;
  brand_id: number;
  created_by_user_id: number;
  name: string;
  description: string | null;
  is_public: boolean;
  items: ReleaseTaskTemplateItem[];
  createdByUser?: { id: number; first_name: string; last_name: string };
  brand?: { id: number; brand_name: string };
}

export interface CreateTemplateItemDto {
  title: string;
  notes?: string;
  days_before_release?: number | null;
  sort_order?: number;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  is_public: boolean;
  items: CreateTemplateItemDto[];
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  is_public?: boolean;
  items?: CreateTemplateItemDto[];
}
