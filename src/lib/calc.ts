/**
 * Toutes les règles de calcul de l'application, sous forme de fonctions pures
 * (sans accès à la base de données) — elles sont couvertes par les tests unitaires.
 */
import type { Delivery, Payout, Shift } from './types';

const HOUR_MS = 3_600_000;

/** Durée totale des pauses d'un quart (ms). Une pause en cours compte jusqu'à `now`. */
export function breakMs(shift: Shift, now: number = Date.now()): number {
  if (shift.breakMinutes != null) return Math.max(0, shift.breakMinutes) * 60_000;
  const shiftEnd = shift.end ? new Date(shift.end).getTime() : now;
  let total = 0;
  for (const b of shift.breaks) {
    const s = new Date(b.start).getTime();
    const e = b.end ? new Date(b.end).getTime() : Math.min(now, shiftEnd);
    if (e > s) total += e - s;
  }
  return total;
}

/** Durée brute (début → fin ou maintenant), en ms. */
export function grossMs(shift: Shift, now: number = Date.now()): number {
  const s = new Date(shift.start).getTime();
  const e = shift.end ? new Date(shift.end).getTime() : now;
  return Math.max(0, e - s);
}

/** Temps rémunéré = durée brute − pauses non rémunérées. */
export function workedMs(shift: Shift, now: number = Date.now()): number {
  return Math.max(0, grossMs(shift, now) - breakMs(shift, now));
}

/** Salaire d'un quart en cents (arrondi au cent le plus proche). */
export function shiftSalary(shift: Shift, now: number = Date.now()): number {
  return Math.round((workedMs(shift, now) * shift.hourlyRate) / HOUR_MS);
}

export function isOnBreak(shift: Shift): boolean {
  return !shift.end && shift.breaks.some((b) => b.end === null);
}

export interface TipTotals {
  cash: number;
  machine: number;
  total: number;
  cashCount: number;
  machineCount: number;
  count: number;
}

export function tipTotals(deliveries: Delivery[]): TipTotals {
  const t: TipTotals = { cash: 0, machine: 0, total: 0, cashCount: 0, machineCount: 0, count: 0 };
  for (const d of deliveries) {
    if (d.method === 'cash') {
      t.cash += d.amount;
      t.cashCount++;
    } else {
      t.machine += d.amount;
      t.machineCount++;
    }
  }
  t.total = t.cash + t.machine;
  t.count = t.cashCount + t.machineCount;
  return t;
}

export interface DaySummary extends TipTotals {
  date: string;
  shifts: Shift[];
  workedMs: number;
  breakMs: number;
  salary: number;
  income: number; // salaire + pourboires
  avgTip: number | null; // cents par livraison
  hourly: number | null; // revenu par heure (cents)
  firstStart: string | null;
  lastEnd: string | null;
  active: boolean;
}

export function summarizeDay(date: string, shifts: Shift[], deliveries: Delivery[], now: number = Date.now()): DaySummary {
  const dayShifts = shifts.filter((s) => s.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const dayDeliveries = deliveries.filter((d) => d.date === date);
  const tips = tipTotals(dayDeliveries);
  let wMs = 0;
  let bMs = 0;
  let salary = 0;
  for (const s of dayShifts) {
    wMs += workedMs(s, now);
    bMs += breakMs(s, now);
    salary += shiftSalary(s, now);
  }
  const income = salary + tips.total;
  const active = dayShifts.some((s) => !s.end);
  const ends = dayShifts.map((s) => s.end).filter((e): e is string => !!e).sort();
  return {
    date,
    shifts: dayShifts,
    ...tips,
    workedMs: wMs,
    breakMs: bMs,
    salary,
    income,
    avgTip: tips.count > 0 ? Math.round(tips.total / tips.count) : null,
    hourly: wMs >= 60_000 ? Math.round((income * HOUR_MS) / wMs) : null,
    firstStart: dayShifts[0]?.start ?? null,
    lastEnd: active ? null : ends[ends.length - 1] ?? null,
    active,
  };
}

/** Liste triée (plus récente d'abord) de toutes les journées ayant un quart ou une livraison. */
export function allDays(shifts: Shift[], deliveries: Delivery[]): string[] {
  const set = new Set<string>();
  shifts.forEach((s) => set.add(s.date));
  deliveries.forEach((d) => set.add(d.date));
  return [...set].sort().reverse();
}

export function summarizeAllDays(shifts: Shift[], deliveries: Delivery[], now: number = Date.now()): DaySummary[] {
  // Indexation par journée pour rester rapide même avec des années d'historique.
  const sBy = new Map<string, Shift[]>();
  const dBy = new Map<string, Delivery[]>();
  for (const s of shifts) (sBy.get(s.date) ?? sBy.set(s.date, []).get(s.date)!).push(s);
  for (const d of deliveries) (dBy.get(d.date) ?? dBy.set(d.date, []).get(d.date)!).push(d);
  return allDays(shifts, deliveries).map((day) => summarizeDay(day, sBy.get(day) ?? [], dBy.get(day) ?? [], now));
}

export interface PeriodStats extends TipTotals {
  days: number;
  workedMs: number;
  salary: number;
  income: number;
  avgTip: number | null;
  hourly: number | null;
}

/** Agrège les journées comprises entre from et to (inclus). */
export function periodStats(summaries: DaySummary[], from: string, to: string): PeriodStats {
  const r: PeriodStats = { days: 0, workedMs: 0, salary: 0, income: 0, cash: 0, machine: 0, total: 0, cashCount: 0, machineCount: 0, count: 0, avgTip: null, hourly: null };
  for (const s of summaries) {
    if (s.date < from || s.date > to) continue;
    r.days++;
    r.workedMs += s.workedMs;
    r.salary += s.salary;
    r.cash += s.cash;
    r.machine += s.machine;
    r.cashCount += s.cashCount;
    r.machineCount += s.machineCount;
  }
  r.total = r.cash + r.machine;
  r.count = r.cashCount + r.machineCount;
  r.income = r.salary + r.total;
  r.avgTip = r.count > 0 ? Math.round(r.total / r.count) : null;
  r.hourly = r.workedMs >= 60_000 ? Math.round((r.income * HOUR_MS) / r.workedMs) : null;
  return r;
}

// ───────────────────────── Remises du patron ─────────────────────────

export interface DayMachineBalance {
  date: string;
  accrued: number; // pourboires machine gagnés ce jour
  paid: number; // part déjà remise par le patron
  due: number; // reste à recevoir
}

export interface PayoutLedger {
  totalAccrued: number;
  totalPaid: number; // somme de toutes les remises enregistrées
  totalDue: number; // reste à recevoir (jamais négatif)
  credit: number; // excédent si le patron a remis plus que le dû (avance)
  byDay: Map<string, DayMachineBalance>;
}

/**
 * Rapprochement des pourboires MACHINE avec les remises du patron.
 * - Seules les remises saisies explicitement comptent (jamais de remise automatique).
 * - Une remise associée à une journée (forDate) couvre d'abord cette journée.
 * - Le reste des remises couvre les journées les plus anciennes en premier (FIFO).
 * - Les pourboires CASH ne sont jamais concernés.
 */
export function computeLedger(deliveries: Delivery[], payouts: Payout[]): PayoutLedger {
  const accrued = new Map<string, number>();
  for (const d of deliveries) if (d.method === 'machine') accrued.set(d.date, (accrued.get(d.date) ?? 0) + d.amount);

  const days = [...accrued.keys()].sort();
  const remaining = new Map(days.map((d) => [d, accrued.get(d)!]));
  const paid = new Map(days.map((d) => [d, 0]));

  const ordered = [...payouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  let pool = 0;
  // 1) Remises ciblées sur une journée
  for (const p of ordered) {
    if (p.forDate && remaining.has(p.forDate)) {
      const take = Math.min(p.amount, remaining.get(p.forDate)!);
      remaining.set(p.forDate, remaining.get(p.forDate)! - take);
      paid.set(p.forDate, paid.get(p.forDate)! + take);
      pool += p.amount - take;
    } else {
      pool += p.amount;
    }
  }
  // 2) Le reste, du plus ancien au plus récent
  for (const d of days) {
    if (pool <= 0) break;
    const take = Math.min(pool, remaining.get(d)!);
    remaining.set(d, remaining.get(d)! - take);
    paid.set(d, paid.get(d)! + take);
    pool -= take;
  }

  const byDay = new Map<string, DayMachineBalance>();
  let totalAccrued = 0;
  let totalDue = 0;
  for (const d of days) {
    totalAccrued += accrued.get(d)!;
    totalDue += remaining.get(d)!;
    byDay.set(d, { date: d, accrued: accrued.get(d)!, paid: paid.get(d)!, due: remaining.get(d)! });
  }
  const totalPaid = payouts.reduce((s, p) => s + p.amount, 0);
  return { totalAccrued, totalPaid, totalDue, credit: pool, byDay };
}

export function dayBalance(ledger: PayoutLedger, date: string): DayMachineBalance {
  return ledger.byDay.get(date) ?? { date, accrued: 0, paid: 0, due: 0 };
}
