import { useQuery } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';
import type { MicrobiologyReference } from './types';

/**
 * Справочник микробиологии — один запрос на весь сеанс.
 *
 * `staleTime: Infinity`, как у списка МКБ-10 и по той же причине: это не данные врача, а
 * справочник, одинаковый для всех и меняющийся только с релизом. Перепрашивать его при каждом
 * заходе в раздел значило бы возить шестьдесят килобайт ради таблицы, в которой не изменилось ни
 * строки.
 *
 * Ошибка сети здесь **не глушится**, в отличие от списка специальностей. Там пустой ответ означает
 * «отбора нет», и раздел работает целиком; здесь без справочника толковать нечем вовсе, и молча
 * показать пустой разбор значило бы соврать, что бланк чист.
 */
export function useMicrobiologyReference() {
  const query = useQuery<MicrobiologyReference>({
    queryKey: ['microbiology-reference'],
    queryFn: () => request<MicrobiologyReference>('/microbiology/reference'),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return { reference: query.data, isLoading: query.isPending, error: query.error };
}
