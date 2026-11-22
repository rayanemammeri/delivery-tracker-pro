import { HandCoins } from 'lucide-react';
import type { DayMachineBalance, DaySummary } from '../lib/calc';
import { formatMoney } from '../lib/money';
import { navigate } from '../lib/router';

/** Section CASH / MACHINE avec barre de répartition et suivi des remises du patron. */
export function TipSplit({ s, bal, globalDue }: { s: DaySummary; bal: DayMachineBalance; globalDue: number }) {
  const pct = s.total > 0 ? (s.cash / s.total) * 100 : 50;
  return (
    <section className="card p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest muted">Pourboires CASH / MACHINE</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-500/10 p-3">
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">CASH · {s.cashCount}</div>
          <div className="text-2xl font-extrabold tabular-nums" data-testid="tip-cash">{formatMoney(s.cash)}</div>
          <div className="text-[11px] muted">Reçu en main</div>
        </div>
        <div className="rounded-xl bg-indigo-500/10 p-3">
          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">MACHINE · {s.machineCount}</div>
          <div className="text-2xl font-extrabold tabular-nums" data-testid="tip-machine">{formatMoney(s.machine)}</div>
          <div className="text-[11px] muted">À remettre par le patron</div>
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${s.total ? pct : 0}%` }} />
        <div className="bg-indigo-500 transition-all duration-500" style={{ width: `${s.total ? 100 - pct : 0}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="muted">Total des pourboires</span>
        <b className="tabular-nums" data-testid="tip-total">{formatMoney(s.total)}</b>
      </div>

      <button onClick={() => navigate('patron')} className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-left active:scale-[0.99] dark:border-white/10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide muted">
          <HandCoins size={14} /> Pourboires machine remis par le patron
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[11px] muted">Accumulés</div>
            <div className="font-bold tabular-nums">{formatMoney(bal.accrued)}</div>
          </div>
          <div>
            <div className="text-[11px] muted">Déjà remis</div>
            <div className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(bal.paid)}</div>
          </div>
          <div>
            <div className="text-[11px] muted">Reste</div>
            <div className="font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatMoney(bal.due)}</div>
          </div>
        </div>
        {globalDue !== bal.due && <div className="mt-2 text-center text-xs muted">Toutes journées : {formatMoney(globalDue)} à recevoir →</div>}
      </button>
    </section>
  );
}
