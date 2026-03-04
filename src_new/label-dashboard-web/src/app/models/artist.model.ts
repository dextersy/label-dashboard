export interface Artist {
  id: number;
  name: string;
  profile_photo: string;
  band_members?: string;
  profile_photo_id?: number;
  profilePhotoImage?: {
    id: number;
    path: string;
    credits?: string;
    date_uploaded: Date;
  };
}
