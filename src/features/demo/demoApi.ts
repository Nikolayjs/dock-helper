import { DEMO_DOCTOR } from './demoDoctor';
import { createDemoData } from './demoFixtures';
import { DEMO_ICD10 } from './demoIcd10';
import { DEMO_DATA_KEY } from './demoSession';

/**
 * Сервер демо-режима, живущий в браузере.
 *
 * Подменяется он **в одном месте** — в `request()` из `lib/httpRepository.ts`, через который идут и
 * все восемнадцать репозиториев, и два десятка отдельных вызовов. Подменять фабрику репозиториев,
 * как предлагало ТЗ, было бы мало: визиты пациента, наблюдения диспансерного учёта, отметка
 * калькулятора избранным и импорт картотеки в фабрику не укладываются и ходили бы мимо неё на
 * настоящий бэкенд — в демо-сессии без токена это дало бы 401 на каждое второе действие.
 *
 * Хранилище — обычный объект, сохраняемый в `sessionStorage`: правки внутри демо переживают
 * переходы по страницам и перезагрузку вкладки, но не саму вкладку. Именно это и обещано словами
 * «данные не сохраняются».
 */
type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

let store: Store | null = null;

function load(): Store {
  if (store) return store;
  try {
    const saved = sessionStorage.getItem(DEMO_DATA_KEY);
    store = saved ? (JSON.parse(saved) as Store) : createDemoData();
  } catch {
    store = createDemoData();
  }
  return store;
}

function save(): void {
  try {
    sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(store));
  } catch {
    // Приватное окно или переполненное хранилище: демо продолжает работать в памяти.
  }
}

/** Ошибка демо-режима. Текст видит врач, поэтому он объясняет, а не жалуется. */
export class DemoUnavailableError extends Error {}

const now = () => new Date().toISOString();
const newId = () => `demo-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

function collection(name: string): Row[] {
  const data = load();
  data[name] ??= [];
  return data[name];
}

function body(init?: RequestInit): Row {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body) as Row;
  } catch {
    return {};
  }
}

function byId(rows: Row[], id: string): Row {
  const row = rows.find((item) => item.id === id);
  if (!row) throw new DemoUnavailableError('Запись не найдена — возможно, она уже удалена в этой демо-сессии.');
  return row;
}

/** Резервный порядок: список отдаётся отсортированным по времени создания, как это делает бэкенд. */
function listOf(name: string): Row[] {
  return [...collection(name)];
}

function createIn(name: string, payload: Row): Row {
  const row = { ...payload, id: newId(), createdAt: now(), updatedAt: now() };
  collection(name).push(row);
  save();
  return row;
}

function updateIn(name: string, id: string, payload: Row): Row {
  const row = byId(collection(name), id);
  Object.assign(row, payload, { updatedAt: now() });
  save();
  return row;
}

function removeIn(name: string, id: string): void {
  const rows = collection(name);
  const index = rows.findIndex((item) => item.id === id);
  if (index >= 0) rows.splice(index, 1);
  save();
}

/**
 * Адреса, которых в демо быть не может: они ведут не к данным, а к серверу.
 *
 * Распознавание сканов — это Tesseract на бэкенде, приглашение в рабочее пространство и смена
 * пароля — настоящий аккаунт, которого у гостя нет. Кнопки, ведущие сюда, в демо спрятаны; ошибка
 * остаётся страховкой на случай, если какая-то дорога к ним найдётся мимо кнопки.
 */
const BACKEND_ONLY = ['/document-templates/recognize', '/workspace/invite', '/auth/me/password'];

export async function demoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const [pathname, query = ''] = path.split('?');
  const segments = pathname.split('/').filter(Boolean);
  const payload = body(init);

  if (BACKEND_ONLY.some((prefix) => pathname.startsWith(prefix))) {
    throw new DemoUnavailableError('В демо-режиме это недоступно: действие выполняется на сервере, а демо работает без него.');
  }

  // В рабочем пространстве демо один человек — сам гость. Список участников читает планер, и
  // отдать ему ошибку значило бы сломать доски там, где ничего серверного не происходит.
  if (pathname === '/workspace/members') {
    return [
      { id: DEMO_DOCTOR.id, name: DEMO_DOCTOR.name, role: DEMO_DOCTOR.role, username: DEMO_DOCTOR.username, avatarDataUrl: null },
    ] as T;
  }

  // ── База знаний: список без текстов, полный текст — по id или по ?full=1 ──────────────────────
  if (segments[0] === 'knowledge-documents' && method === 'GET') {
    const docs = listOf('/knowledge-documents');
    if (segments[1]) return byId(docs, segments[1]) as T;
    if (query.includes('full=1')) return docs as T;
    return docs.map(({ content: _content, ...rest }) => rest) as T;
  }

  // ── Визиты пациента ──────────────────────────────────────────────────────────────────────────
  if (segments[0] === 'patients' && segments[2] === 'visits') {
    const patient = byId(collection('/patients'), segments[1]);
    const visits = (patient.visits ??= []) as Row[];
    if (method === 'POST') {
      const created = { ...payload, id: newId(), createdAt: now() };
      visits.push(created);
      patient.updatedAt = now();
      save();
      return created as T;
    }
    const visitId = segments[3];
    if (method === 'PATCH') {
      const target = byId(visits, visitId);
      Object.assign(target, payload);
      patient.updatedAt = now();
      save();
      return target as T;
    }
    if (method === 'DELETE') {
      const index = visits.findIndex((item) => item.id === visitId);
      if (index >= 0) visits.splice(index, 1);
      patient.updatedAt = now();
      save();
      return undefined as T;
    }
  }

  if (pathname === '/patients/import' && method === 'POST') {
    const incoming = (payload.patients ?? []) as Row[];
    const created = incoming.map((item) => ({
      ...item,
      id: newId(),
      visits: [],
      reminderDate: item.reminderDate ?? null,
      reminderNote: item.reminderNote ?? '',
      createdAt: now(),
      updatedAt: now(),
    }));
    collection('/patients').push(...created);
    save();
    return { created: created.length, skipped: 0 } as T;
  }

  // ── Диспансерный учёт: наблюдения, снятие и возврат ──────────────────────────────────────────
  if (segments[0] === 'dispensary' && segments[1]) {
    const record = byId(collection('/dispensary'), segments[1]);

    if (segments[2] === 'observations') {
      const observations = (record.observations ??= []) as Row[];
      if (method === 'POST') {
        const created = { ...payload, id: newId(), createdAt: now() };
        observations.push(created);
        record.updatedAt = now();
        save();
        return created as T;
      }
      const observationId = segments[3];
      if (method === 'PATCH') {
        const target = byId(observations, observationId);
        Object.assign(target, payload);
        record.updatedAt = now();
        save();
        return target as T;
      }
      if (method === 'DELETE') {
        const index = observations.findIndex((item) => item.id === observationId);
        if (index >= 0) observations.splice(index, 1);
        record.updatedAt = now();
        save();
        return undefined as T;
      }
    }

    if (segments[2] === 'remove-from-registry' && method === 'PATCH') {
      Object.assign(record, { status: 'removed', removedDate: payload.removedDate ?? null, removedReason: payload.removedReason ?? null, updatedAt: now() });
      save();
      return record as T;
    }

    if (segments[2] === 'reinstate' && method === 'PATCH') {
      Object.assign(record, { status: 'active', removedDate: null, removedReason: null, updatedAt: now() });
      save();
      return record as T;
    }
  }

  // ── Чек-лист заметки ─────────────────────────────────────────────────────────────────────────
  if (segments[0] === 'notes' && segments[2] === 'items' && segments[4] === 'toggle' && method === 'PATCH') {
    const note = byId(collection('/notes'), segments[1]);
    const item = byId((note.items ?? []) as Row[], segments[3]);
    item.done = !item.done;
    note.updatedAt = now();
    save();
    return note as T;
  }

  // ── Звёздочка калькулятора ───────────────────────────────────────────────────────────────────
  if (segments[0] === 'calculators' && segments[2] === 'favourite' && method === 'PATCH') {
    const calculator = byId(collection('/calculators'), segments[1]);
    calculator.favourite = payload.favourite ?? !calculator.favourite;
    save();
    return calculator as T;
  }

  // ── Мелочи, у которых в демо нет источника ───────────────────────────────────────────────────
  // Названия диагнозов по кодам МКБ: в демо их даёт тот же короткий список, что и поиск. Чего в
  // списке нет, интерфейс покажет самим кодом — как и при недоступном справочнике.
  if (pathname === '/icd10/names') {
    const codes = new Set(decodeURIComponent(query.replace(/^codes=/, '')).split(','));
    return Object.fromEntries(DEMO_ICD10.filter((entry) => codes.has(entry.code)).map((entry) => [entry.code, entry.name])) as T;
  }

  if (pathname === '/news-feed-sources/archive-settings') {
    const settings = { enabled: false, retentionDays: 30 };
    return (method === 'GET' ? settings : { ...settings, ...payload }) as T;
  }

  if (segments[0] === 'news-feed-sources' && segments[2] === 'items') return { items: [] } as T;

  // ── Всё остальное — обычный список с обычным CRUD ────────────────────────────────────────────
  const name = `/${segments[0]}`;
  if (!(name in load())) {
    if (method === 'GET') return [] as T;
    throw new DemoUnavailableError('В демо-режиме этот раздел недоступен.');
  }

  if (method === 'GET') return (segments[1] ? byId(collection(name), segments[1]) : listOf(name)) as T;
  if (method === 'POST') return createIn(name, payload) as T;
  if (method === 'PATCH' || method === 'PUT') return updateIn(name, segments[1], payload) as T;
  if (method === 'DELETE') {
    removeIn(name, segments[1]);
    return undefined as T;
  }

  throw new DemoUnavailableError('В демо-режиме это действие недоступно.');
}

/** Сбрасывает кэш модуля — чтобы новый вход в демо начинался с исходных данных. */
export function forgetDemoStore(): void {
  store = null;
}
