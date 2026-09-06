import { useQuery } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';
import type { MicrobiologyReference, OrganismProfile } from './types';

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

/**
 * Подробный разбор одного возбудителя.
 *
 * Запрашивается **только когда карточку открыли**, и в этом весь смысл отдельной ручки: шестьдесят
 * разборов внутри справочника платил бы каждый, кто зашёл разобрать посев, а читает их тот, кто
 * пришёл разбираться. `staleTime: Infinity` по той же причине, что у справочника, — это не данные
 * врача, а текст, меняющийся с релизом.
 *
 * **`retry: false`, и это не мелочь.** Ключ приходит из адреса, поэтому единственный реальный отказ
 * здесь — 404 «такого возбудителя нет», а его повтор ничего не исправит: он только оттягивает
 * честный ответ на время отсрочки и печатает второй 404 в консоль. Замер на стенде: два запроса
 * вместо одного. Та же настройка и по той же причине у карточки кода МКБ-10.
 */
export function useOrganismProfile(key: string | undefined) {
  const query = useQuery<OrganismProfile>({
    queryKey: ['microbiology-organism', key],
    queryFn: () => request<OrganismProfile>(`/microbiology/organisms/${encodeURIComponent(key!)}`),
    enabled: Boolean(key),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return { profile: query.data, isLoading: query.isPending, error: query.error };
}
