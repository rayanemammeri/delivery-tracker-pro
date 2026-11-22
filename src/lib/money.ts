/** Formate des cents en dollars canadiens, style québécois : « 1 234,50 $ ». */
export function formatMoney(cents: number, opts: { sign?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const c = abs % 100;
  const intStr = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const s = `${intStr},${String(c).padStart(2, '0')} $`;
  if (neg) return `−${s}`;
  if (opts.sign && cents > 0) return `+${s}`;
  return s;
}

/** Convertit une saisie (« 5,50 », « 5.5 », « 5 $ ») en cents. Retourne null si invalide. */
export function parseMoney(input: string): number | null {
  const t = input.replace(/\s|\$/g, '').replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [i, d = ''] = t.split('.');
  return Number(i) * 100 + Number(d.padEnd(2, '0'));
}

/** Cents → chaîne éditable « 5,50 ». */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}
