import { useMutation } from '@tanstack/react-query';

import { request } from '../../../lib/httpRepository';
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
      form.append('image', image, 'form.png');
      return request<TemplateLayout>('/document-templates/recognize', { method: 'POST', body: form });
    },
  });

  return {
    recognise: mutation.mutateAsync,
    isRecognising: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
