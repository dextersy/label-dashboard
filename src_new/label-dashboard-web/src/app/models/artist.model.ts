export interface Artist {
  id: number;
  name: string;
  profile_photo: string;
  band_members?: string;
  profile_photo_id?: number;
  status?: 'Active' | 'Inactive';
  custom_data?: Record<string, any>;
  profilePhotoImage?: {
    id: number;
    path: string;
    credits?: string;
    date_uploaded: Date;
  };
}

export interface ArtistCustomField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'array';
  required?: boolean;
  options?: string[];
}
