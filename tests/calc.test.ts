import { describe, expect, it } from 'vitest';
import { computeLedger, dayBalance, periodStats, shiftSalary, summarizeAllDays, summarizeDay, tipTotals, workedMs } from '../src/lib/calc';
import { formatMoney, parseMoney } from '../src/lib/money';
import { buildDailyReport, reportToText } from '../src/lib/report';
import { buildShiftTimes, combineWorkday, workdayOf, weekStart, monthEnd } from '../src/lib/time';
import type { Delivery, PaymentMethod, Payout, Shift } from '../src/lib/types';

let n = 0;
const del = (date: string, amount: number, method: PaymentMethod, hm = '18:00'): Delivery => ({
  id: 'd' + ++n, date, amount, method, time: combineWorkday(date, hm).toISOString(), createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});
const shift = (date: string, start: string, end: string | null, extra: Partial<Shift> = {}): Shift => {
  const t = buildShiftTimes(date, start, end);
  return { id: 's' + ++n, date, start: t.start.toISOString(), end: t.end?.toISOString() ?? null, breaks: [], breakMinutes: null, hourlyRate: 1200, createdAt: 'x', updatedAt: 'x', ...extra };
};
const pay = (amount: number, date: string, forDate: string | null = null): Payout => ({ id: 'p' + ++n, amount, date, forDate, note: '', createdAt: `${date}T12:00:00Z#${n}`, updatedAt: 'x' });

describe('Montants', () => {
  it('formate en dollars canadiens', () => {
    expect(formatMoney(550)).toBe('5,50 $');
    expect(formatMoney(123456)).toBe('1 234,56 $');
    expect(formatMoney(0)).toBe('0,00 $');
  });
  it('lit les saisies avec virgule ou point', () => {
    expect(parseMoney('5,50')).toBe(550);
    expect(parseMoney('5.5')).toBe(550);
    expect(parseMoney('7,25 $')).toBe(725);
    expect(parseMoney('4')).toBe(400);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1,234')).toBeNull();
  });
  it("n'a pas d'erreur d'arrondi en additionnant beaucoup de pourboires", () => {
    const list = Array.from({ length: 1000 }, (_, i) => del('2026-11-21', 10, i % 2 ? 'cash' : 'machine')); // 1000 × 0,10 $
    expect(tipTotals(list).total).toBe(10000); // exactement 100,00 $
  });
});

describe('Pourboires CASH / MACHINE', () => {
  const list = [del('2026-11-21', 550, 'cash'), del('2026-11-21', 400, 'machine'), del('2026-11-21', 725, 'cash'), del('2026-11-21', 350, 'machine')];
  it('additionne et sépare les catégories (exemple du cahier des charges)', () => {
    const t = tipTotals(list);
    expect(t.cash).toBe(1275);
    expect(t.machine).toBe(750);
    expect(t.total).toBe(2025);
    expect(t.cashCount).toBe(2);
    expect(t.machineCount).toBe(2);
    expect(t.count).toBe(4);
  });
  it('calcule la moyenne par livraison', () => {
    expect(summarizeDay('2026-11-21', [], list).avgTip).toBe(506); // 20,25 / 4 = 5,0625 → 5,06 $
  });
});

describe('Heures et salaire à 12 $/h', () => {
  it('16 h → 22 h = 6 h = 72 $', () => {
    const s = shift('2026-11-21', '16:00', '22:00');
    expect(workedMs(s)).toBe(6 * 3600000);
    expect(shiftSalary(s)).toBe(7200);
  });
  it('minutes partielles : 6 h 15 = 75 $ ; 7 h 20 = 88 $', () => {
    expect(shiftSalary(shift('2026-11-21', '16:00', '22:15'))).toBe(7500);
    expect(shiftSalary(shift('2026-11-21', '11:00', '18:20'))).toBe(8800);
  });
  it('déduit les pauses non rémunérées (manuelles et chronométrées)', () => {
    expect(shiftSalary(shift('2026-11-21', '16:00', '22:00', { breakMinutes: 30 }))).toBe(6600);
    const s = shift('2026-11-21', '16:00', '22:00');
    s.breaks = [{ start: combineWorkday('2026-11-21', '19:00').toISOString(), end: combineWorkday('2026-11-21', '19:45').toISOString() }];
    expect(workedMs(s)).toBe(5.25 * 3600000);
    expect(shiftSalary(s)).toBe(6300);
  });
  it('quart en cours : calcule jusqu’à maintenant', () => {
    const s = shift('2026-11-21', '16:00', null);
    const now = combineWorkday('2026-11-21', '17:30').getTime();
    expect(shiftSalary(s, now)).toBe(1800);
  });
  it('salaire à un autre taux', () => {
    expect(shiftSalary(shift('2026-11-21', '16:00', '20:00', { hourlyRate: 1575 }))).toBe(6300);
  });
});

describe('Horaires après minuit', () => {
  it('18 h → 2 h = 8 h, fin le lendemain, rattaché à la journée du début', () => {
    const s = shift('2026-11-21', '18:00', '02:00');
    expect(new Date(s.end!).getDate()).toBe(22);
    expect(workedMs(s)).toBe(8 * 3600000);
    expect(shiftSalary(s)).toBe(9600);
    expect(s.date).toBe('2026-11-21');
  });
  it('22 h → 6 h (fin après l’heure de coupure) = 8 h', () => {
    expect(workedMs(shift('2026-11-21', '22:00', '06:00'))).toBe(8 * 3600000);
  });
  it('une livraison à 1 h 30 appartient à la journée de la veille', () => {
    expect(workdayOf(new Date(2026, 10, 22, 1, 30))).toBe('2026-11-21');
    expect(workdayOf(new Date(2026, 10, 22, 9, 0))).toBe('2026-11-22');
  });
  it('fonctionne au changement d’heure (3 → 4 novembre 2024 à Toronto : nuit de 25 h)', () => {
    const s = shift('2024-11-02', '20:00', '04:00');
    expect(workedMs(s)).toBe(9 * 3600000); // 8 h d'horloge + 1 h réelle supplémentaire
  });
});

describe('Remises du patron (pourboires MACHINE)', () => {
  it('exemple : 95 $ accumulés, 60 $ remis → 35 $ à recevoir', () => {
    const d = [del('2026-11-21', 9500, 'machine'), del('2026-11-21', 5500, 'cash')];
    const l = computeLedger(d, [pay(6000, '2026-11-21')]);
    expect(dayBalance(l, '2026-11-21')).toEqual({ date: '2026-11-21', accrued: 9500, paid: 6000, due: 3500 });
    expect(l.totalDue).toBe(3500);
  });
  it('les pourboires CASH ne sont jamais dus par le patron', () => {
    const l = computeLedger([del('2026-11-21', 5500, 'cash')], []);
    expect(l.totalAccrued).toBe(0);
    expect(l.totalDue).toBe(0);
  });
  it('rien n’est remis automatiquement', () => {
    const l = computeLedger([del('2026-11-21', 9500, 'machine')], []);
    expect(l.totalPaid).toBe(0);
    expect(l.totalDue).toBe(9500);
  });
  it('remises en plusieurs fois, du plus ancien au plus récent', () => {
    const d = [del('2026-11-20', 4000, 'machine'), del('2026-11-21', 9500, 'machine')];
    const l = computeLedger(d, [pay(2500, '2026-11-21'), pay(3000, '2026-11-22')]);
    expect(dayBalance(l, '2026-11-20')).toMatchObject({ paid: 4000, due: 0 });
    expect(dayBalance(l, '2026-11-21')).toMatchObject({ paid: 1500, due: 8000 });
    expect(l.totalPaid).toBe(5500);
    expect(l.totalDue).toBe(8000);
  });
  it('remise ciblée sur une journée précise', () => {
    const d = [del('2026-11-20', 4000, 'machine'), del('2026-11-21', 9500, 'machine')];
    const l = computeLedger(d, [pay(6000, '2026-11-22', '2026-11-21')]);
    expect(dayBalance(l, '2026-11-20')).toMatchObject({ paid: 0, due: 4000 });
    expect(dayBalance(l, '2026-11-21')).toMatchObject({ paid: 6000, due: 3500 });
  });
  it('excédent : le patron a remis plus que le dû', () => {
    const l = computeLedger([del('2026-11-21', 1000, 'machine')], [pay(1500, '2026-11-21')]);
    expect(l.totalDue).toBe(0);
    expect(l.credit).toBe(500);
  });
});

describe('Bilan quotidien', () => {
  it('reproduit l’exemple du cahier des charges', () => {
    const shifts = [shift('2026-11-21', '16:00', '22:00')];
    const dels = [del('2026-11-21', 5500, 'cash'), del('2026-11-21', 9500, 'machine')];
    const payouts = [pay(6000, '2026-11-21')];
    const s = summarizeDay('2026-11-21', shifts, dels);
    expect(s.salary).toBe(7200);
    expect(s.total).toBe(15000);
    expect(s.income).toBe(22200);
    expect(s.hourly).toBe(3700);
    const text = reportToText(buildDailyReport(s, computeLedger(dels, payouts), payouts));
    for (const expected of ['DATE : 21 novembre 2026', 'Début : 16 h 00', 'Fin : 22 h 00', 'Total travaillé : 6 h 00', 'Salaire de la journée : 72,00 $', 'Pourboires CASH (1) : 55,00 $', 'Pourboires MACHINE (1) : 95,00 $', 'Total des pourboires : 150,00 $', 'Pourboires machine accumulés : 95,00 $', 'Pourboires machine déjà remis : 60,00 $', 'Reste à recevoir (cette journée) : 35,00 $', 'Revenu total : 222,00 $', 'Pourboires déjà reçus : 115,00 $']) {
      expect(text).toContain(expected);
    }
  });
});

describe('Statistiques hebdomadaires et mensuelles', () => {
  const shifts = [shift('2026-11-16', '16:00', '22:00'), shift('2026-11-18', '17:00', '21:00'), shift('2026-11-23', '16:00', '20:00'), shift('2026-10-31', '16:00', '18:00')];
  const dels = [del('2026-11-16', 1000, 'cash'), del('2026-11-18', 500, 'machine'), del('2026-11-23', 700, 'cash'), del('2026-10-31', 300, 'machine')];
  const sums = summarizeAllDays(shifts, dels);
  it('semaine du lundi 16 au dimanche 22 novembre', () => {
    expect(weekStart('2026-11-22')).toBe('2026-11-16');
    const w = periodStats(sums, '2026-11-16', '2026-11-22');
    expect(w.days).toBe(2);
    expect(w.salary).toBe(12000); // 10 h × 12 $
    expect(w.cash).toBe(1000);
    expect(w.machine).toBe(500);
    expect(w.income).toBe(13500);
    expect(w.count).toBe(2);
    expect(w.hourly).toBe(1350);
    expect(w.avgTip).toBe(750);
  });
  it('mois de novembre (exclut octobre)', () => {
    const m = periodStats(sums, '2026-11-01', monthEnd('2026-11-15'));
    expect(m.days).toBe(3);
    expect(m.salary).toBe(16800);
    expect(m.total).toBe(2200);
    expect(m.income).toBe(19000);
  });
  it('historique trié du plus récent au plus ancien', () => {
    expect(sums.map((s) => s.date)).toEqual(['2026-11-23', '2026-11-18', '2026-11-16', '2026-10-31']);
  });
});
