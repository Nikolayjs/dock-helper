import { useMutation } from '@tanstack/react-query';

import { request } from '../../../lib/httpRepository';
import { fitForOcr } from '../../../lib/ocrImage';
import type { TemplateLayout } from './layoutTypes';

/**
 * Sends a cropped form image to the backend for recognition and gets back a draft layout. Nothing
 * is persisted server-side by this call — an unconvincing result costs a retry, not a stray
 * template to clean up afterwards.
 */
export function useFormRecognition() {
  const mutation = useMutation({
    mutationFn: async (image: Blob) => {
      const form = new FormData();
      // Снимок с телефона — 3000–4000 px, и на такой ширине Tesseract читает линовку бланка как
      // текст. Приведение к рабочему размеру — то же правило, что у бланка анализов.
      form.append('image', await fitForOcr(image), 'form.png');
      return request<TemplateLayout>('/document-templates/recognize', { method: 'POST', body: form });
    },
  });

  return {
    recognise: mutation.mutateAsync,
    isRecognising: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
