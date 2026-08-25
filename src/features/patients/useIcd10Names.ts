import { useQuery } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';

/**
 * Resolves ICD-10 codes to disease names.
 *
 * A register loaded from a spreadsheet often records the code and nothing else — a whole dispensary
 * list can arrive as `J35.0` repeated — and a report that says `J35.0` instead of `Хронический
 * тонзиллит` is not a report anyone can read. Fetched in one call for every code on the page, and
 * cached: the nomenclature does not change while the doctor is looking at it.
 */

/** A bare code and nothing else: `J35.0`, `M21`, `Z01.1`. */
const BARE_CODE = /^[A-ZА-Я]\d{2}(\.\d{1,2})?$/i;

export function isBareIcdCode(text: string): boolean {
  return BARE_CODE.test(text.trim());
}

export function useIcd10Names(codes: string[]) {
  const unique = [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))].sort();

  const { data } = useQuery({
    queryKey: ['icd10-names', unique.join(',')],
    queryFn: () => request<Record<string, string>>(`/icd10/names?codes=${encodeURIComponent(unique.join(','))}`),
    enabled: unique.length > 0,
    staleTime: Infinity,
  });

  return data ?? {};
}

/**
 * The code to show for a diagnosis.
 *
 * A register that recorded only the code puts it in the diagnosis field, leaving the code field
 * empty — so the report ended up naming the disease correctly and showing a dash where its code
 * belongs, with the code sitting right there in the row it came from.
 */
export function diagnosisCodeOf(diagnosis: string, diagnosisCode: string | undefined): string | undefined {
  if (diagnosisCode?.trim()) return diagnosisCode.trim().toUpperCase();
  const text = diagnosis.trim();
  return isBareIcdCode(text) ? text.toUpperCase() : undefined;
}

/**
 * What to call a diagnosis on screen.
 *
 * The stored text wins whenever it is a real name. Only when it is a bare code — or missing — does
 * the nomenclature fill in, so a doctor's own wording is never overwritten by the official one.
 */
export function diagnosisLabel(
  diagnosis: string,
  diagnosisCode: string | undefined,
  names: Record<string, string>,
): string {
  const text = diagnosis.trim();
  if (text && !isBareIcdCode(text)) return text;

  const code = (diagnosisCode || text).trim().toUpperCase();
  return names[code] ?? text ?? '';
}
