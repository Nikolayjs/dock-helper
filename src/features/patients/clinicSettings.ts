/**
 * Doctor/clinic details shown on printed documents. Backed by `/api/clinic-settings` (a singleton
 * resource — one shared row, see the backend's README on per-user scoping). Several call sites
 * (DocumentLetterhead, DocumentSignature, DocumentTemplateForm, TemplateDocument) read this
 * synchronously mid-render, so it's cached in module state after an async load — `loadClinicSettings`
 * is called once during AuthContext's bootstrap, before any of those consumers can mount, so
 * `getClinicSettings()` always has real data by the time it's read from render.
 */
import { API_BASE_URL } from '../../lib/apiConfig';
import { backendErrorMessage } from '../newsFeed/backendError';
import { getAuthToken } from '../../lib/tokenStore';

export interface ClinicSettings {
  specialty: string;
  clinicName: string;
  clinicAddress: string;
  licenseNumber: string;
}

const DEFAULT_SETTINGS: ClinicSettings = {
  specialty: '',
  clinicName: '',
  clinicAddress: '',
  licenseNumber: '',
};

let cache: ClinicSettings = DEFAULT_SETTINGS;

function authHeaders(): HeadersInit | undefined {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

/** The backend's response is entity-shaped (`id`, `updatedAt`) — narrow it so the cache (and a later save built from it) never carries fields `UpdateClinicSettingsDto` would reject. */
function pick(raw: ClinicSettings): ClinicSettings {
  return { specialty: raw.specialty, clinicName: raw.clinicName, clinicAddress: raw.clinicAddress, licenseNumber: raw.licenseNumber };
}

export function getClinicSettings(): ClinicSettings {
  return cache;
}

export async function loadClinicSettings(): Promise<ClinicSettings> {
  const response = await fetch(`${API_BASE_URL}/clinic-settings`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await backendErrorMessage(response, `Не удалось загрузить настройки клиники (${response.status}).`));
  cache = pick((await response.json()) as ClinicSettings);
  return cache;
}

export async function setClinicSettings(settings: ClinicSettings): Promise<ClinicSettings> {
  const response = await fetch(`${API_BASE_URL}/clinic-settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(pick(settings)),
  });
  if (!response.ok) throw new Error(await backendErrorMessage(response, `Не удалось сохранить настройки клиники (${response.status}).`));
  cache = pick((await response.json()) as ClinicSettings);
  return cache;
}
