import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { computeLedger, summarizeAllDays, type DaySummary, type PayoutLedger } from '../lib/calc';
import { DEFAULT_SETTINGS, type Delivery, type Payout, type Settings, type Shift } from '../lib/types';
import { workdayOf } from '../lib/time';

interface Data {
  ready: boolean;
  shifts: Shift[];
  deliveries: Delivery[];
  payouts: Payout[];
  settings: Settings;
  activeShift: Shift | undefined;
  /** Journée en cours : celle du quart actif, sinon la date du jour (coupure à 5 h). */
  today: string;
  ledger: PayoutLedger;
  summaries: DaySummary[];
  now: number;
}

const Ctx = createContext<Data | null>(null);

/**
 * Fournit toutes les données à l'application. useLiveQuery recharge automatiquement
 * dès qu'une table change : tous les totaux se mettent à jour immédiatement.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const shifts = useLiveQuery(() => db.shifts.toArray(), []);
  const deliveries = useLiveQuery(() => db.deliveries.orderBy('time').toArray(), []);
  const payouts = useLiveQuery(() => db.payouts.toArray(), []);
  const settingsRow = useLiveQuery(() => db.kv.get('settings').then((r) => r ?? null), []);
  const activeShift = shifts?.find((s) => s.end === null);
  const [now, setNow] = useState(Date.now());

  // Rafraîchit chaque seconde pendant un quart (chronomètre, salaire en direct), sinon chaque minute.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), activeShift ? 1000 : 60000);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [activeShift]);

  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...((settingsRow?.value as Partial<Settings>) ?? {}) }), [settingsRow]);
  const ledger = useMemo(() => computeLedger(deliveries ?? [], payouts ?? []), [deliveries, payouts]);
  const summaries = useMemo(() => summarizeAllDays(shifts ?? [], deliveries ?? [], now), [shifts, deliveries, now]);

  const value: Data = {
    ready: !!shifts && !!deliveries && !!payouts && settingsRow !== undefined,
    shifts: shifts ?? [],
    deliveries: deliveries ?? [],
    payouts: payouts ?? [],
    settings,
    activeShift,
    today: activeShift ? activeShift.date : workdayOf(new Date(now)),
    ledger,
    summaries,
    now,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const v = useContext(Ctx);
  if (!v) throw new Error('DataProvider manquant');
  return v;
}
