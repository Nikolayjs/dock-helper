import { useCallback, useMemo } from 'react';
import { useLocalStorage } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';

import { API_BASE_URL } from '../../lib/apiConfig';
import { useAuth } from '../auth/AuthContext';
import { isDemoSession } from '../demo/demoSession';
import type { Specialty } from './types';

/** Какой из трёх справочников отбирается. */
export type SpecialtyScope = 'icd' | 'drugs' | 'guidelines';

const FIELD: Record<SpecialtyScope, keyof Pick<Specialty, 'icdBlocks' | 'drugCategories' | 'guidelineSections'>> = {
  icd: 'icdBlocks',
  drugs: 'drugCategories',
  guidelines: 'guidelineSections',
};

/**
 * Не загрузилось — значит отбора нет, и это единственный безопасный отказ.
 *
 * Пустой список специальностей выключает тумблер везде: страница показывает справочник целиком.
 * Любой другой исход — красная плашка, повтор, а тем более «отобрать по тому, что успело
 * приехать» — означал бы, что сбой сети **прячет** от врача часть справочника.
 */
async function fetchSpecialties(): Promise<Specialty[]> {
  if (isDemoSession()) return [];
  try {
    const response = await fetch(`${API_BASE_URL}/specialties`);
    if (!response.ok) return [];
    return (await response.json()) as Specialty[];
  } catch {
    return [];
  }
}

export function useSpecialties() {
  const { data } = useQuery({
    queryKey: ['specialties'],
    queryFn: fetchSpecialties,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return data ?? [];
}

export interface SpecialtyFilter {
  /** Специальность врача или `null`, если не выбрана (либо список не приехал). */
  specialty: Specialty | null;
  /** Специальность выбрана, но в этом справочнике ей не относится ничего. */
  emptyHere: boolean;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  /** Отбор включён и действительно работает — только по этому признаку что-то прячется. */
  active: boolean;
  /** Относится ли строка к специальности: блок МКБ, раздел формуляра, раздел рекомендаций. */
  matches: (key: string) => boolean;
}

/**
 * Отбор по специальности врача — один механизм на три справочника.
 *
 * **Выключен по умолчанию и включается руками.** Отбор прячет часть справочника, а спрятанного не
 * видно: врач, не знающий, что фильтр включён, прочитает пустой результат как «такого кода нет».
 * Поэтому включение — это всегда осознанное действие, а страница, пока он включён, обязана
 * говорить, сколько именно записей спрятано.
 *
 * **Состояние тумблера — настройка вида, и живёт оно в `localStorage`**, рядом с сортировкой
 * таблиц и раскладкой дашборда. На сервере лежит сама специальность: она про врача и обязана
 * переезжать вместе с ним на другую машину. А вот «сейчас я смотрю справочник целиком» — про
 * текущий сеанс работы за этим экраном, и синхронизировать это между устройствами незачем.
 */
export function useSpecialtyFilter(scope: SpecialtyScope): SpecialtyFilter {
  const user = useAuth();
  const specialties = useSpecialties();

  const [enabled, setEnabled] = useLocalStorage({
    key: `medassist:specialty-filter:${scope}`,
    defaultValue: false,
  });

  const specialty = useMemo(
    () => (user.specialty ? (specialties.find((s) => s.id === user.specialty) ?? null) : null),
    [specialties, user.specialty],
  );

  const keys = useMemo(() => new Set(specialty ? specialty[FIELD[scope]] : []), [specialty, scope]);

  const matches = useCallback((key: string) => keys.has(key), [keys]);

  const emptyHere = specialty !== null && keys.size === 0;

  return {
    specialty,
    emptyHere,
    enabled,
    setEnabled,
    active: specialty !== null && !emptyHere && enabled,
    matches,
  };
}
