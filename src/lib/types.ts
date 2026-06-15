export interface Article {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  categoryName: string;
  image: string;
  author: string;
  date: string;
  readTime: string;
  featured: boolean;
  tags: string[];
  coverImageCaption?: string;
}

export interface Category {
  name: string;
  slug: string;
  color: string;
}

