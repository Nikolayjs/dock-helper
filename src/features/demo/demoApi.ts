import { DEMO_DOCTOR } from './demoDoctor';
import { createDemoData } from './demoFixtures';
import { DEMO_ICD10 } from './demoIcd10';
import { DEMO_DATA_KEY } from './demoSession';
import { demoStoreItems } from './demoStore';

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
const BACKEND_ONLY = [
  '/document-templates/recognize',
  '/workspace/invite',
  '/auth/me/password',
  '/auth/sign-out-everywhere',
  // Токен расширения — удостоверение настоящего аккаунта, которого у гостя нет. Раздел в профиле в
  // демо не показывается; ошибка остаётся страховкой на случай, если дорога сюда найдётся мимо него.
  '/extension-tokens',
];

export async function demoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const [pathname = '', query = ''] = path.split('?');
  // Отрезок адреса, которого нет, — это пустая строка: дальше она честно не найдёт запись и
  // отдаст «запись не найдена», а не уронит демо на `undefined`.
  const segments = pathname.split('/').filter(Boolean);
  const seg = (index: number) => segments[index] ?? '';
  const payload = body(init);

  if (BACKEND_ONLY.some((prefix) => pathname.startsWith(prefix))) {
    throw new DemoUnavailableError('В демо-режиме это недоступно: действие выполняется на сервере, а демо работает без него.');
  }

  // В рабочем пространстве демо один человек — сам гость. Список участников читает планер, и
  // отдать ему ошибку значило бы сломать доски там, где ничего серверного не происходит.
  if (pathname === '/workspace/members') {
    return [
      {
        id: DEMO_DOCTOR.id,
        name: DEMO_DOCTOR.name,
        role: DEMO_DOCTOR.role,
        username: DEMO_DOCTOR.username,
        avatarDataUrl: null,
        accessRole: DEMO_DOCTOR.accessRole,
      },
    ] as T;
  }

  // ── База знаний: список без текстов, полный текст — по id ────────────────────────────────────
  if (segments[0] === 'knowledge-documents' && method === 'GET') {
    const docs = listOf('/knowledge-documents');
    if (seg(1)) return byId(docs, seg(1)) as T;
    return docs.map(({ content: _content, ...rest }) => rest) as T;
  }

  // ── Справочник сокращений: разделы отдаются списком, а не как запись с id «sections» ─────────
  // Своя ветка обязательна ровно по той же причине, что у `/drugs/search`: без неё общий разбор
  // прочитал бы «sections» как идентификатор и отдал «запись не найдена», то есть форма добавления
  // осталась бы без списка разделов.
  if (pathname === '/abbreviations/sections' && method === 'GET') {
    return [...new Set(collection('/abbreviations').map((row) => String(row.category ?? '')))].filter(Boolean) as T;
  }

  // ── Справочник заболеваний: связи в обе стороны ─────────────────────────────────────────────
  // Свои ветки обязательны по той же причине, что у `/drugs/search`: без них «by-code» и
  // «mentions» разобрались бы как идентификаторы записи, и в демо карточка кода МКБ-10 молча
  // ничего не знала бы о болезнях, а обратные ссылки не появлялись бы вовсе.
  if (pathname.startsWith('/diseases/by-code/') && method === 'GET') {
    const code = decodeURIComponent(pathname.slice('/diseases/by-code/'.length)).toUpperCase();
    const rubric = code.includes('.') ? code.slice(0, code.indexOf('.')) : code;
    return collection('/diseases')
      .filter((row) =>
        ((row.icdCodes as string[]) ?? []).some((raw) => {
          const own = raw.trim().toUpperCase();
          return own === code || own === rubric || own.startsWith(`${code}.`);
        }),
      )
      .map((row) => ({ id: row.id, name: row.name, summary: row.summary })) as T;
  }

  if (pathname.endsWith('/mentions') && pathname.startsWith('/diseases/') && method === 'GET') {
    const id = pathname.slice('/diseases/'.length, -'/mentions'.length);
    const target = collection('/diseases').find((row) => row.id === id);
    if (!target) return [] as T;
    const names = [String(target.name), ...(((target.synonyms as string[]) ?? []))].map((name) => name.trim().toLowerCase());
    return collection('/diseases')
      .filter((row) => {
        if (row.id === id) return false;
        const links = [...String(row.description ?? '').matchAll(/\[\[([^\]]+)\]\]/g)]
          .map((match) => match[1].split('|')[0].trim().toLowerCase());
        return links.some((title) => names.includes(title));
      })
      .map((row) => ({ id: row.id, name: row.name, summary: row.summary })) as T;
  }

  // ── Поиск препарата для строки в шапке ───────────────────────────────────────────────────────
  // Своя ветка обязательна: без неё `/drugs/search` разобрался бы как карточка с id «search» и
  // отдал бы «запись не найдена» — то есть поиск в демо молча ничего не находил бы.
  if (pathname === '/drugs/search' && method === 'GET') {
    const term = decodeURIComponent(new URLSearchParams(query).get('q') ?? '').trim().toLowerCase();
    if (term.length < 2) return [] as T;
    const limit = Number(new URLSearchParams(query).get('limit') ?? 8) || 8;
    return collection('/drugs')
      .filter((drug) => {
        const inn = String(drug.inn ?? '').toLowerCase();
        const brands = (drug.brandNames as string[] | undefined) ?? [];
        return inn.includes(term) || brands.some((name) => name.toLowerCase().includes(term));
      })
      .slice(0, limit) as T;
  }

  // ── Картотека: сводка, визиты и полная запись ────────────────────────────────────────────────
  // Настоящий сервер отдаёт список **без** визитов, а визиты — отдельными ручками. Без этих веток
  // демо разбирало бы `/patients/visits` как карточку пациента с идентификатором «visits» — та же
  // ловушка, что у `/drugs/search`, — и сводные экраны остались бы пустыми.
  if (pathname === '/patients' && method === 'GET') {
    return collection('/patients').map(({ visits, ...patient }) => {
      const list = (visits as Row[] | undefined) ?? [];
      // Сравнением, а не «первый в списке»: демо дописывает новый визит в конец.
      const last = list.reduce<Row | null>((latest, visit) => (!latest || String(visit.date) > String(latest.date) ? visit : latest), null);
      return {
        ...patient,
        lastVisit: last ? { date: last.date, diagnosis: last.diagnosis, diagnosisCode: last.diagnosisCode } : null,
        visitCount: list.length,
      };
    }) as T;
  }

  if (pathname === '/patients/visits' && method === 'GET') {
    return collection('/patients').flatMap((patient) =>
      (((patient.visits as Row[] | undefined) ?? []).map(({ note: _note, ...visit }) => ({ ...visit, patientId: patient.id }))),
    ) as T;
  }

  if (segments[0] === 'patients' && segments[1] === 'visits' && segments[2] === 'day' && method === 'GET') {
    const date = seg(3);
    return collection('/patients').flatMap((patient) =>
      (((patient.visits as Row[] | undefined) ?? []).filter((visit) => visit.date === date).map((visit) => ({ ...visit, patientId: patient.id }))),
    ) as T;
  }

  if (pathname === '/patients/full' && method === 'GET') {
    return collection('/patients') as T;
  }

  // ── Визиты пациента ──────────────────────────────────────────────────────────────────────────
  if (segments[0] === 'patients' && segments[2] === 'visits') {
    const patient = byId(collection('/patients'), seg(1));
    const visits = (patient.visits ??= []) as Row[];
    if (method === 'POST') {
      const created = { ...payload, id: newId(), createdAt: now() };
      visits.push(created);
      patient.updatedAt = now();
      save();
      return created as T;
    }
    const visitId = seg(3);
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
  if (segments[0] === 'dispensary' && seg(1)) {
    const record = byId(collection('/dispensary'), seg(1));

    if (segments[2] === 'observations') {
      const observations = (record.observations ??= []) as Row[];
      if (method === 'POST') {
        const created = { ...payload, id: newId(), createdAt: now() };
        observations.push(created);
        record.updatedAt = now();
        save();
        return created as T;
      }
      const observationId = seg(3);
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
    const note = byId(collection('/notes'), seg(1));
    const item = byId((note.items ?? []) as Row[], seg(3));
    item.done = !item.done;
    note.updatedAt = now();
    save();
    return note as T;
  }

  // ── Звёздочка калькулятора ───────────────────────────────────────────────────────────────────
  if (segments[0] === 'calculators' && segments[2] === 'favourite' && method === 'PATCH') {
    const calculator = byId(collection('/calculators'), seg(1));
    calculator.favourite = payload.favourite ?? !calculator.favourite;
    save();
    return calculator as T;
  }

  // ── Магазин: витрина показывается, установка — нет ───────────────────────────────────────────
  if (pathname === '/store/items' && method === 'GET') return demoStoreItems(load()) as T;
  if (pathname === '/store/install') {
    throw new DemoUnavailableError(
      'В демо-режиме магазин работает как витрина: установка меняет набор рабочего пространства, а гостевая сессия ничего не сохраняет.',
    );
  }

  // ── Мелочи, у которых в демо нет источника ───────────────────────────────────────────────────
  // Названия диагнозов по кодам МКБ: в демо их даёт тот же короткий список, что и поиск. Чего в
  // списке нет, интерфейс покажет самим кодом — как и при недоступном справочнике.
  if (pathname === '/icd10/names') {
    const codes = new Set(decodeURIComponent(query.replace(/^codes=/, '')).split(','));
    return Object.fromEntries(DEMO_ICD10.filter((entry) => codes.has(entry.code)).map((entry) => [entry.code, entry.name])) as T;
  }

  // Личные настройки в демо остаются в браузере: синхронизировать их не с чем и незачем —
  // гостевая сессия обещает, что ничего не сохраняется.
  if (pathname === '/user-settings') return (method === 'GET' ? {} : {}) as T;

  // Push-уведомления шлёт сервер, а демо работает без него. Отвечаем честным «не настроено»:
  // переключатель тогда не показывается вовсе и ничего не обещает.
  if (pathname === '/push/public-key') return { publicKey: null } as T;

  if (pathname === '/news-feed-sources/archive-settings') {
    const settings = { enabled: false, retentionDays: 30 };
    return (method === 'GET' ? settings : { ...settings, ...payload }) as T;
  }

  if (segments[0] === 'news-feed-sources' && segments[2] === 'items') return { items: [] } as T;

  // ── Всё остальное — обычный список с обычным CRUD ────────────────────────────────────────────
  const name = `/${seg(0)}`;
  if (!(name in load())) {
    if (method === 'GET') return [] as T;
    throw new DemoUnavailableError('В демо-режиме этот раздел недоступен.');
  }

  if (method === 'GET') return (seg(1) ? byId(collection(name), seg(1)) : listOf(name)) as T;
  if (method === 'POST') return createIn(name, payload) as T;
  if (method === 'PATCH' || method === 'PUT') return updateIn(name, seg(1), payload) as T;
  if (method === 'DELETE') {
    removeIn(name, seg(1));
    return undefined as T;
  }

  throw new DemoUnavailableError('В демо-режиме это действие недоступно.');
}

/** Сбрасывает кэш модуля — чтобы новый вход в демо начинался с исходных данных. */
export function forgetDemoStore(): void {
  store = null;
}
