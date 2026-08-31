import { readSetting, writeSetting } from '../../lib/settingsStore';

/**
 * How often each document template is actually printed.
 *
 * Nothing in the database records this — a template has a title and a body and no history — so it
 * is counted here, in `localStorage`. That is the right place for it as well as the cheap one: the
 * list is a shortcut, and a shortcut that is missing on the laptop rebuilds itself after a few
 * documents. A layout has to be reassembled by hand; this does not.
 */
export interface TemplateUse {
  count: number;
  lastUsedAt: string;
}

export const STORAGE_KEY = 'medassist:document-usage';

/** Beyond this the tail is noise, and the file has no reason to grow without bound. */
const MAX_TRACKED = 40;

export type UsageMap = Record<string, TemplateUse>;

export function readUsage(): UsageMap {
  try {
    const raw = readSetting(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const usage: UsageMap = {};

    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const { count, lastUsedAt } = value as Partial<TemplateUse>;
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
      usage[id] = { count: Math.floor(count), lastUsedAt: typeof lastUsedAt === 'string' ? lastUsedAt : '' };
    }
    return usage;
  } catch {
    return {};
  }
}

function writeUsage(usage: UsageMap): void {
  try {
    writeSetting(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Private mode or a full quota: the shortcut simply stops learning.
  }
}

/** Counts one use of a template. Safe to call on every render of the printable page — see below. */
export function recordTemplateUse(templateId: string, now = new Date()): void {
  const usage = readUsage();
  const current = usage[templateId];
  usage[templateId] = { count: (current?.count ?? 0) + 1, lastUsedAt: now.toISOString() };

  // Keep the busiest; a template used once a year ago is not a shortcut worth remembering.
  const entries = Object.entries(usage).sort(([, a], [, b]) => b.count - a.count || b.lastUsedAt.localeCompare(a.lastUsedAt));
  writeUsage(Object.fromEntries(entries.slice(0, MAX_TRACKED)));
}

export interface RankedTemplate {
  id: string;
  count: number;
  lastUsedAt: string;
}

/** The most used templates first, dropping ids whose template has since been deleted. */
export function rankTemplates(usage: UsageMap, knownIds: Set<string>, limit = 5): RankedTemplate[] {
  return Object.entries(usage)
    .filter(([id]) => knownIds.has(id))
    .map(([id, use]) => ({ id, count: use.count, lastUsedAt: use.lastUsedAt }))
    .sort((a, b) => b.count - a.count || b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, limit);
}
