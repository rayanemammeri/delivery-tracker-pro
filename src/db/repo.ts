/**
 * Couche d'accès aux données : TOUTES les écritures passent par ici.
 * Pour ajouter une synchronisation cloud plus tard, il suffira de brancher
 * un SyncAdapter (voir sync.ts) qui reçoit chaque changement.
 */
import { db } from './db';
import type { Delivery, Payout, PaymentMethod, Settings, Shift } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';
import { workdayOf } from '../lib/time';
import { notifyChange } from './sync';

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

const nowIso = () => new Date().toISOString();

// ───────────── Réglages ─────────────
export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await getSettings();
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } });
}

// ───────────── Quarts de travail ─────────────
export async function getActiveShift(): Promise<Shift | undefined> {
  const all = await db.shifts.toArray();
  return all.find((s) => s.end === null);
}

/** Journée à laquelle rattacher une nouvelle livraison : celle du quart en cours, sinon la journée actuelle. */
export async function currentWorkday(now = new Date()): Promise<string> {
  const active = await getActiveShift();
  return active ? active.date : workdayOf(now);
}

export async function startShift(at = new Date()): Promise<Shift> {
  return db.transaction('rw', db.shifts, db.kv, async () => {
    const active = await getActiveShift();
    if (active) return active; // jamais deux quarts actifs en même temps
    const settings = await getSettings();
    const t = nowIso();
    const shift: Shift = {
      id: uid(),
      date: workdayOf(at),
      start: at.toISOString(),
      end: null,
      breaks: [],
      breakMinutes: null,
      hourlyRate: settings.hourlyRate,
      createdAt: t,
      updatedAt: t,
    };
    await db.shifts.add(shift);
    notifyChange('shifts', shift.id);
    return shift;
  });
}

export async function endShift(at = new Date()): Promise<void> {
  await db.transaction('rw', db.shifts, async () => {
    const active = await getActiveShift();
    if (!active) return;
    const iso = at.toISOString();
    const breaks = active.breaks.map((b) => (b.end ? b : { ...b, end: iso }));
    await db.shifts.update(active.id, { end: iso, breaks, updatedAt: nowIso() });
    notifyChange('shifts', active.id);
  });
}

export async function toggleBreak(at = new Date()): Promise<void> {
  await db.transaction('rw', db.shifts, async () => {
    const active = await getActiveShift();
    if (!active) return;
    const iso = at.toISOString();
    const open = active.breaks.find((b) => b.end === null);
    const breaks = open
      ? active.breaks.map((b) => (b === open ? { ...b, end: iso } : b))
      : [...active.breaks, { start: iso, end: null }];
    await db.shifts.update(active.id, { breaks, updatedAt: nowIso() });
    notifyChange('shifts', active.id);
  });
}

export async function saveShift(shift: Omit<Shift, 'createdAt' | 'updatedAt'> & { createdAt?: string }): Promise<void> {
  const t = nowIso();
  if (shift.end === null) {
    const active = await getActiveShift();
    if (active && active.id !== shift.id) throw new Error('Un autre quart est déjà en cours. Terminez-le d’abord.');
  }
  if (shift.end && shift.end <= shift.start) throw new Error('La fin doit être après le début.');
  await db.shifts.put({ ...shift, createdAt: shift.createdAt ?? t, updatedAt: t });
  notifyChange('shifts', shift.id);
}

export async function deleteShift(id: string): Promise<void> {
  await db.shifts.delete(id);
  notifyChange('shifts', id);
}

// ───────────── Livraisons ─────────────
export async function addDelivery(amount: number, method: PaymentMethod, at = new Date(), date?: string): Promise<Delivery> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('Montant invalide');
  const t = nowIso();
  const d: Delivery = {
    id: uid(),
    date: date ?? (await currentWorkday(at)),
    amount,
    method,
    time: at.toISOString(),
    createdAt: t,
    updatedAt: t,
  };
  await db.deliveries.add(d);
  await saveSettings({ defaultMethod: method });
  notifyChange('deliveries', d.id);
  return d;
}

export async function updateDelivery(id: string, patch: Partial<Pick<Delivery, 'amount' | 'method' | 'time' | 'date'>>): Promise<void> {
  if (patch.amount != null && (!Number.isInteger(patch.amount) || patch.amount < 0)) throw new Error('Montant invalide');
  await db.deliveries.update(id, { ...patch, updatedAt: nowIso() });
  notifyChange('deliveries', id);
}

export async function deleteDelivery(id: string): Promise<Delivery | undefined> {
  const d = await db.deliveries.get(id);
  await db.deliveries.delete(id);
  notifyChange('deliveries', id);
  return d;
}

export async function restoreDelivery(d: Delivery): Promise<void> {
  await db.deliveries.put(d);
  notifyChange('deliveries', d.id);
}

// ───────────── Remises du patron ─────────────
export async function addPayout(p: { amount: number; date: string; forDate: string | null; note: string }): Promise<Payout> {
  if (!Number.isInteger(p.amount) || p.amount <= 0) throw new Error('Le montant doit être supérieur à 0');
  const t = nowIso();
  const payout: Payout = { id: uid(), ...p, note: p.note.trim(), createdAt: t, updatedAt: t };
  await db.payouts.add(payout);
  notifyChange('payouts', payout.id);
  return payout;
}

export async function updatePayout(id: string, patch: Partial<Pick<Payout, 'amount' | 'date' | 'forDate' | 'note'>>): Promise<void> {
  if (patch.amount != null && (!Number.isInteger(patch.amount) || patch.amount <= 0)) throw new Error('Montant invalide');
  await db.payouts.update(id, { ...patch, updatedAt: nowIso() });
  notifyChange('payouts', id);
}

export async function deletePayout(id: string): Promise<void> {
  await db.payouts.delete(id);
  notifyChange('payouts', id);
}

// ───────────── Sauvegarde / restauration ─────────────
export interface BackupFile {
  app: 'delivery-tracker-pro';
  version: 1;
  exportedAt: string;
  settings: Settings;
  shifts: Shift[];
  deliveries: Delivery[];
  payouts: Payout[];
}

export async function exportBackup(): Promise<BackupFile> {
  const [settings, shifts, deliveries, payouts] = await Promise.all([getSettings(), db.shifts.toArray(), db.deliveries.toArray(), db.payouts.toArray()]);
  return { app: 'delivery-tracker-pro', version: 1, exportedAt: nowIso(), settings, shifts, deliveries, payouts };
}

function validateBackup(data: unknown): asserts data is BackupFile {
  const b = data as BackupFile;
  if (!b || b.app !== 'delivery-tracker-pro' || !Array.isArray(b.shifts) || !Array.isArray(b.deliveries) || !Array.isArray(b.payouts)) {
    throw new Error('Fichier de sauvegarde invalide.');
  }
  for (const d of b.deliveries) {
    if (typeof d.id !== 'string' || !Number.isInteger(d.amount) || (d.method !== 'cash' && d.method !== 'machine')) throw new Error('Livraison invalide dans la sauvegarde.');
  }
}

/**
 * Restaure une sauvegarde. mode « merge » : fusionne par identifiant (aucun doublon, la version
 * la plus récente gagne). mode « replace » : remplace toutes les données.
 */
export async function importBackup(data: unknown, mode: 'merge' | 'replace'): Promise<{ shifts: number; deliveries: number; payouts: number }> {
  validateBackup(data);
  await db.transaction('rw', db.shifts, db.deliveries, db.payouts, db.kv, async () => {
    if (mode === 'replace') {
      await Promise.all([db.shifts.clear(), db.deliveries.clear(), db.payouts.clear()]);
      await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...data.settings } });
    }
    const merge = async <T extends { id: string; updatedAt: string }>(table: import('dexie').Table<T, string>, rows: T[]) => {
      const existing = new Map((await table.bulkGet(rows.map((r) => r.id))).filter(Boolean).map((r) => [r!.id, r!]));
      const toPut = rows.filter((r) => !existing.has(r.id) || existing.get(r.id)!.updatedAt < r.updatedAt);
      await table.bulkPut(toPut);
    };
    await merge(db.shifts as never, data.shifts);
    await merge(db.deliveries as never, data.deliveries);
    await merge(db.payouts as never, data.payouts);
  });
  notifyChange('all', '*');
  return { shifts: data.shifts.length, deliveries: data.deliveries.length, payouts: data.payouts.length };
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.shifts, db.deliveries, db.payouts, async () => {
    await Promise.all([db.shifts.clear(), db.deliveries.clear(), db.payouts.clear()]);
  });
  notifyChange('all', '*');
}

/** Demande au navigateur de ne pas effacer les données en cas de manque d'espace. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignoré */
  }
  return false;
}
