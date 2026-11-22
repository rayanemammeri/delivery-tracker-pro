/**
 * Utilitaires de dates (heure locale de l'appareil).
 * Une « journée de travail » change à DAY_CUTOFF_HOUR (5 h) : une livraison à 1 h du matin
 * appartient à la journée de la veille. Les quarts gardent la date de leur début.
 */
export const DAY_CUTOFF_HOUR = 5;

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Journée de travail correspondant à un instant (tient compte de l'heure de coupure). */
export function workdayOf(d: Date): string {
  const x = new Date(d);
  if (x.getHours() < DAY_CUTOFF_HOUR) x.setDate(x.getDate() - 1);
  return dateKey(x);
}

export function timeHM(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** « 16 h 00 » */
export function timeFr(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()} h ${pad(d.getMinutes())}`;
}

/**
 * Construit un instant à partir d'une journée de travail et d'une heure « HH:MM ».
 * Une heure avant la coupure (ex. 01:30) est placée le lendemain calendrier.
 */
export function combineWorkday(day: string, hm: string): Date {
  const [h, m] = hm.split(':').map(Number);
  const d = parseDateKey(day);
  d.setHours(h, m, 0, 0);
  if (h < DAY_CUTOFF_HOUR) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Début et fin d'un quart à partir de saisies manuelles. Si la fin est avant ou égale au début,
 * elle est placée le lendemain (quart qui passe minuit).
 */
export function buildShiftTimes(day: string, startHM: string, endHM: string | null): { start: Date; end: Date | null } {
  const start = combineWorkday(day, startHM);
  if (!endHM) return { start, end: null };
  const end = combineWorkday(day, endHM);
  while (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Durée en ms → « 6 h 05 » */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} h ${pad(m)}`;
}

/** Durée en ms → « 06:05:12 » pour le chronomètre */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Durée en heures décimales arrondies au centième, avec virgule : « 6,25 h » */
export function formatHoursDecimal(ms: number): string {
  return `${(ms / 3600000).toFixed(2).replace('.', ',')} h`;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** « 21 novembre 2026 » */
export function formatDateLong(key: string): string {
  const d = parseDateKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « samedi 21 novembre » */
export function formatDateWeekday(key: string): string {
  const d = parseDateKey(key);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 21 nov. » */
export function formatDateShort(key: string): string {
  const d = parseDateKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function monthLabel(key: string): string {
  const d = parseDateKey(key);
  const s = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return s[0].toUpperCase() + s.slice(1);
}

/** Lundi de la semaine contenant la journée. */
export function weekStart(key: string): string {
  const d = parseDateKey(key);
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - dow);
  return dateKey(d);
}

export function monthStart(key: string): string {
  return key.slice(0, 8) + '01';
}

export function monthEnd(key: string): string {
  const d = parseDateKey(monthStart(key));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return dateKey(d);
}

export function addMonths(key: string, n: number): string {
  const d = parseDateKey(monthStart(key));
  d.setMonth(d.getMonth() + n);
  return dateKey(d);
}
