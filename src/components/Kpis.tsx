import { Banknote, Clock, CreditCard, Gauge, Package, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import type { DaySummary } from '../lib/calc';
import { formatMoney } from '../lib/money';
import { formatDuration } from '../lib/time';
import { Stat } from './ui';

/** Les 9 indicateurs du tableau de bord, recalculés automatiquement. */
export function Kpis({ s }: { s: DaySummary }) {
  const i = 13;
  return (
    <div className="space-y-3" data-testid="kpis">
      <div className="card relative overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-500/30 to-emerald-500/30 blur-2xl" />
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-widest muted">Revenu total de la journée</div>
          <div className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight" data-testid="kpi-income">{formatMoney(s.income)}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm muted">
            <span>Salaire <b className="text-slate-900 dark:text-white">{formatMoney(s.salary)}</b></span>
            <span>Pourboires <b className="text-slate-900 dark:text-white">{formatMoney(s.total)}</b></span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={<PiggyBank size={i} />} label="Total pourboires" value={formatMoney(s.total)} />
        <Stat icon={<Wallet size={i} />} label="Salaire accumulé" value={formatMoney(s.salary)} />
        <Stat icon={<Banknote size={i} />} label="Pourboires cash" value={formatMoney(s.cash)} sub={`${s.cashCount} livraison${s.cashCount > 1 ? 's' : ''}`} tone="cash" />
        <Stat icon={<CreditCard size={i} />} label="Pourboires machine" value={formatMoney(s.machine)} sub={`${s.machineCount} livraison${s.machineCount > 1 ? 's' : ''}`} tone="machine" />
        <Stat icon={<Package size={i} />} label="Livraisons" value={String(s.count)} />
        <Stat icon={<Clock size={i} />} label="Heures travaillées" value={formatDuration(s.workedMs)} />
        <Stat icon={<Receipt size={i} />} label="Moy. / livraison" value={s.avgTip != null ? formatMoney(s.avgTip) : '—'} />
        <Stat icon={<Gauge size={i} />} label="Revenu / heure" value={s.hourly != null ? formatMoney(s.hourly) : '—'} />
        <Stat icon={<TrendingUp size={i} />} label="Revenu total" value={formatMoney(s.income)} />
      </div>
    </div>
  );
}
