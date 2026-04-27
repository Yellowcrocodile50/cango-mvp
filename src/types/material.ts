export interface Material {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  file_url: string | null;
  thumbnail_url: string | null;
  preview_images: string[] | null;
  supplier_id: string;
  created_at: string;
}
