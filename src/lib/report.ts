import { dayBalance, type DaySummary, type PayoutLedger } from './calc';
import { formatMoney } from './money';
import { formatDateLong, formatDuration, timeFr } from './time';
import type { Payout } from './types';

export interface ReportSection {
  title: string;
  rows: [string, string][];
  /** Ligne mise en valeur (total). */
  total?: [string, string];
}

export interface DailyReport {
  date: string;
  title: string;
  sections: ReportSection[];
  note: string;
}

/** Construit le bilan quotidien structuré (utilisé pour l'écran, le texte copié et le PDF). */
export function buildDailyReport(s: DaySummary, ledger: PayoutLedger, payouts: Payout[]): DailyReport {
  const bal = dayBalance(ledger, s.date);
  const rate = s.shifts[0]?.hourlyRate ?? 1200;
  const hours: [string, string][] = [];
  if (s.shifts.length === 0) hours.push(['Quarts', 'Aucun quart enregistré']);
  s.shifts.forEach((sh, i) => {
    const prefix = s.shifts.length > 1 ? `Quart ${i + 1} — ` : '';
    hours.push([`${prefix}Début`, timeFr(sh.start)]);
    hours.push([`${prefix}Fin`, sh.end ? timeFr(sh.end) + (new Date(sh.end).getDate() !== new Date(sh.start).getDate() ? ' (lendemain)' : '') : 'En cours']);
  });
  if (s.breakMs > 0) hours.push(['Pauses non rémunérées', formatDuration(s.breakMs)]);
  hours.push(['Total travaillé', formatDuration(s.workedMs)]);
  hours.push(['Salaire horaire', formatMoney(rate)]);

  const paidToday = payouts.filter((p) => p.date === s.date);

  const sections: ReportSection[] = [
    { title: 'HEURES DE TRAVAIL', rows: hours, total: ['Salaire de la journée', formatMoney(s.salary)] },
    {
      title: 'LIVRAISONS ET POURBOIRES',
      rows: [
        ['Nombre de livraisons', String(s.count)],
        [`Pourboires CASH (${s.cashCount})`, formatMoney(s.cash)],
        [`Pourboires MACHINE (${s.machineCount})`, formatMoney(s.machine)],
        ['Moyenne par livraison', s.avgTip != null ? formatMoney(s.avgTip) : '—'],
      ],
      total: ['Total des pourboires', formatMoney(s.total)],
    },
    {
      title: 'VERSEMENTS DU PATRON (POURBOIRES MACHINE)',
      rows: [
        ['Pourboires machine accumulés', formatMoney(bal.accrued)],
        ['Pourboires machine déjà remis', formatMoney(bal.paid)],
        ...paidToday.map((p): [string, string] => [`Remise reçue ce jour${p.note ? ` (${p.note})` : ''}`, formatMoney(p.amount)]),
      ],
      total: ['Reste à recevoir (cette journée)', formatMoney(bal.due)],
    },
    {
      title: 'REVENUS GAGNÉS',
      rows: [
        ['Salaire', formatMoney(s.salary)],
        ['Pourboires', formatMoney(s.total)],
        ['Revenu moyen par heure', s.hourly != null ? formatMoney(s.hourly) : '—'],
      ],
      total: ['Revenu total', formatMoney(s.income)],
    },
    {
      title: 'REÇU / DÛ',
      rows: [
        ['Pourboires CASH (reçus en main)', formatMoney(s.cash)],
        ['Pourboires MACHINE déjà remis', formatMoney(bal.paid)],
        ['Pourboires MACHINE encore dus', formatMoney(bal.due)],
        ['Salaire (versé sur la paie)', formatMoney(s.salary)],
      ],
      total: ['Pourboires déjà reçus', formatMoney(s.cash + bal.paid)],
    },
    {
      title: 'SOLDE GLOBAL AVEC LE PATRON (toutes journées)',
      rows: [
        ['Total machine accumulé', formatMoney(ledger.totalAccrued)],
        ['Total déjà remis', formatMoney(ledger.totalPaid)],
        ...(ledger.credit > 0 ? [['Avance du patron (excédent)', formatMoney(ledger.credit)] as [string, string]] : []),
      ],
      total: ['Reste total à recevoir', formatMoney(ledger.totalDue)],
    },
  ];

  return {
    date: s.date,
    title: 'BILAN QUOTIDIEN',
    sections,
    note: 'Les pourboires CASH sont reçus directement et ne sont jamais inclus dans les montants dus par le patron.',
  };
}

export function reportToText(r: DailyReport): string {
  const lines = [`${r.title} — Delivery Tracker Pro`, `DATE : ${formatDateLong(r.date)}`, ''];
  for (const sec of r.sections) {
    lines.push(sec.title);
    for (const [k, v] of sec.rows) lines.push(`• ${k} : ${v}`);
    if (sec.total) lines.push(`➜ ${sec.total[0]} : ${sec.total[1]}`);
    lines.push('');
  }
  lines.push(r.note);
  return lines.join('\n');
}
