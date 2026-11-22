import { ChevronRight } from 'lucide-react';
import { useData } from '../hooks/data';
import { dayBalance } from '../lib/calc';
import { formatMoney } from '../lib/money';
import { navigate } from '../lib/router';
import { formatDateWeekday, formatDuration, monthLabel } from '../lib/time';
import { Empty } from '../components/ui';

/** Toutes les journées travaillées, regroupées par mois. Toucher une journée pour son bilan / la modifier. */
export function History() {
  const { summaries, ledger } = useData();
  if (summaries.length === 0) return <Empty>Aucune journée enregistrée pour l'instant.</Empty>;

  const groups = new Map<string, typeof summaries>();
  for (const s of summaries) {
    const k = s.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  return (
    <div className="space-y-2" data-testid="history">
      {[...groups.entries()].map(([month, days]) => {
        const total = days.reduce((a, d) => a + d.income, 0);
        return (
          <section key={month}>
            <div className="section-title flex justify-between">
              <span>{monthLabel(month + '-01')}</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
            <div className="space-y-2">
              {days.map((s) => {
                const bal = dayBalance(ledger, s.date);
                return (
                  <button key={s.date} onClick={() => navigate(`bilan/${s.date}`)} className="card block w-full p-4 text-left transition active:scale-[0.99]">
                    <div className="flex items-center justify-between">
                      <span className="block font-semibold first-letter:uppercase">{formatDateWeekday(s.date)}</span>
                      <span className="flex items-center gap-1 text-lg font-extrabold tabular-nums">
                        {formatMoney(s.income)} <ChevronRight size={16} className="muted" />
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                      <Cell k="Heures" v={formatDuration(s.workedMs)} />
                      <Cell k="Livraisons" v={String(s.count)} />
                      <Cell k="Salaire" v={formatMoney(s.salary)} />
                      <Cell k="Cash" v={formatMoney(s.cash)} tone="text-emerald-600 dark:text-emerald-400" />
                      <Cell k="Machine" v={formatMoney(s.machine)} tone="text-indigo-600 dark:text-indigo-400" />
                      <Cell k="Remis / reste" v={`${formatMoney(bal.paid)} / ${formatMoney(bal.due)}`} tone={bal.due > 0 ? 'text-amber-600 dark:text-amber-400' : ''} />
                    </div>
                    {s.active && <div className="mt-2 text-xs font-semibold text-emerald-500">Quart en cours</div>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Cell({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div>
      <div className="muted">{k}</div>
      <div className={`font-semibold tabular-nums ${tone ?? ''}`}>{v}</div>
    </div>
  );
}
