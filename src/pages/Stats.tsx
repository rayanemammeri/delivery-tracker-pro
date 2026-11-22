import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../hooks/data';
import { periodStats } from '../lib/calc';
import { formatMoney } from '../lib/money';
import { addDays, addMonths, formatDateShort, formatDuration, monthEnd, monthLabel, monthStart, weekStart } from '../lib/time';
import { Stat } from '../components/ui';

type Mode = 'semaine' | 'mois' | 'tout';

export function Stats() {
  const { summaries, today, ledger } = useData();
  const [mode, setMode] = useState<Mode>('semaine');
  const [anchor, setAnchor] = useState(today);
  const dark = document.documentElement.classList.contains('dark');

  const [from, to, label] = useMemo((): [string, string, string] => {
    if (mode === 'semaine') {
      const f = weekStart(anchor);
      const t = addDays(f, 6);
      return [f, t, `Semaine du ${formatDateShort(f)} au ${formatDateShort(t)}`];
    }
    if (mode === 'mois') return [monthStart(anchor), monthEnd(anchor), monthLabel(anchor)];
    return ['0000-01-01', '9999-12-31', 'Depuis le début'];
  }, [mode, anchor]);

  const st = periodStats(summaries, from, to);

  const chartData = useMemo(() => {
    if (mode === 'tout') {
      // Totaux par mois
      const map = new Map<string, { label: string; Salaire: number; Cash: number; Machine: number }>();
      for (const s of [...summaries].reverse()) {
        const k = s.date.slice(0, 7);
        const row = map.get(k) ?? { label: monthLabel(k + '-01').slice(0, 4) + ' ' + k.slice(2, 4), Salaire: 0, Cash: 0, Machine: 0 };
        row.Salaire += s.salary / 100;
        row.Cash += s.cash / 100;
        row.Machine += s.machine / 100;
        map.set(k, row);
      }
      return [...map.values()].slice(-12);
    }
    const rows = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const s = summaries.find((x) => x.date === d);
      rows.push({ label: mode === 'semaine' ? ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'][rows.length] : d.slice(8), Salaire: (s?.salary ?? 0) / 100, Cash: (s?.cash ?? 0) / 100, Machine: (s?.machine ?? 0) / 100 });
    }
    return rows;
  }, [mode, from, to, summaries]);

  const weekly = useMemo(() => {
    const rows = [];
    let w = weekStart(today);
    for (let i = 0; i < 8; i++) {
      const p = periodStats(summaries, w, addDays(w, 6));
      rows.unshift({ label: formatDateShort(w), Revenu: p.income / 100, Heure: p.hourly != null ? p.hourly / 100 : null });
      w = addDays(w, -7);
    }
    return rows;
  }, [summaries, today]);

  const shift = (n: number) => setAnchor(mode === 'semaine' ? addDays(anchor, 7 * n) : addMonths(anchor, n));
  const axis = dark ? '#64748b' : '#94a3b8';
  const grid = dark ? '#ffffff12' : '#0000000f';
  const tip = { contentStyle: { background: dark ? '#121826' : '#fff', border: '1px solid ' + grid, borderRadius: 12 }, formatter: (v: number) => formatMoney(Math.round(v * 100)) };

  return (
    <div className="space-y-3" data-testid="stats">
      <div className="card flex p-1">
        {(['semaine', 'mois', 'tout'] as Mode[]).map((m) => (
          <button key={m} onClick={() => { setMode(m); setAnchor(today); }} className={`h-11 flex-1 rounded-xl text-sm font-bold capitalize transition ${mode === m ? 'bg-indigo-600 text-white' : 'muted'}`}>
            {m === 'tout' ? 'Tout' : m}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-1">
        {mode !== 'tout' ? <button aria-label="Période précédente" className="rounded-xl p-2" onClick={() => shift(-1)}><ChevronLeft /></button> : <span />}
        <span className="font-bold" data-testid="period-label">{label}</span>
        {mode !== 'tout' ? <button aria-label="Période suivante" className="rounded-xl p-2" onClick={() => shift(1)}><ChevronRight /></button> : <span />}
      </div>

      <div className="card p-5">
        <div className="text-xs font-bold uppercase tracking-widest muted">Revenu total</div>
        <div className="text-4xl font-extrabold tabular-nums" data-testid="period-income">{formatMoney(st.income)}</div>
        <div className="mt-1 text-sm muted">{st.days} journée{st.days > 1 ? 's' : ''} · {formatDuration(st.workedMs)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total salaires" value={formatMoney(st.salary)} />
        <Stat label="Total pourboires" value={formatMoney(st.total)} />
        <Stat label="Pourboires cash" value={formatMoney(st.cash)} tone="cash" sub={`${st.cashCount} livraisons`} />
        <Stat label="Pourboires machine" value={formatMoney(st.machine)} tone="machine" sub={`${st.machineCount} livraisons`} />
        <Stat label="Livraisons" value={String(st.count)} />
        <Stat label="Moy. / livraison" value={st.avgTip != null ? formatMoney(st.avgTip) : '—'} />
        <Stat label="Revenu / heure" value={st.hourly != null ? formatMoney(st.hourly) : '—'} />
        <Stat label="Machine à recevoir" value={formatMoney(ledger.totalDue)} tone="warn" sub="toutes journées" />
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest muted">{mode === 'tout' ? 'Revenus par mois' : 'Revenus par jour'}</h3>
        <div className="h-60">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ left: -18, right: 4 }}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tip} cursor={{ fill: grid }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Salaire" stackId="a" fill="#94a3b8" />
              <Bar dataKey="Cash" stackId="a" fill="#10b981" />
              <Bar dataKey="Machine" stackId="a" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest muted">Évolution hebdomadaire (8 semaines)</h3>
        <div className="h-52">
          <ResponsiveContainer>
            <LineChart data={weekly} margin={{ left: -18, right: 8 }}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tip} />
              <Line type="monotone" dataKey="Revenu" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {st.total > 0 && (
        <div className="card flex items-center gap-4 p-4">
          <div className="h-32 w-32">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={[{ name: 'Cash', v: st.cash }, { name: 'Machine', v: st.machine }]} dataKey="v" innerRadius={38} outerRadius={60} stroke="none">
                  <Cell fill="#10b981" />
                  <Cell fill="#6366f1" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2 text-sm">
            <div className="text-xs font-bold uppercase tracking-widest muted">Répartition des pourboires</div>
            <div className="flex justify-between"><span className="text-emerald-500">● Cash</span><b>{Math.round((st.cash / st.total) * 100)} %</b></div>
            <div className="flex justify-between"><span className="text-indigo-500">● Machine</span><b>{Math.round((st.machine / st.total) * 100)} %</b></div>
          </div>
        </div>
      )}
    </div>
  );
}
