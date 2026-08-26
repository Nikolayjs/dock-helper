export type BookFormat = 'pdf' | 'fb2' | 'djvu' | 'docx';

export interface BookProgress {
  /** PDF/DjVu: 1-based current page. FB2/DOCX: scroll fraction from 0 to 1. */
  location: number;
  updatedAt: string;
}

export interface Book {
  id: string;
  format: BookFormat;
  title: string;
  author: string;
  description: string;
  coverDataUrl: string | null;
  fileName: string;
  fileSize: number;
  pageCount: number | null;
  progress: BookProgress | null;
  addedAt: string;
  updatedAt: string;
}

export type BookMetaInput = Pick<Book, 'title' | 'author' | 'description'>;
