import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, FileDown, History, Pencil, PlusCircle, Share2 } from 'lucide-react';
import { useData } from '../hooks/data';
import { summarizeDay, workedMs } from '../lib/calc';
import { formatMoney } from '../lib/money';
import { buildDailyReport, reportToText } from '../lib/report';
import { navigate } from '../lib/router';
import { addDays, formatDateLong, formatDuration, timeFr } from '../lib/time';
import type { Shift } from '../lib/types';
import { DeliveryList } from '../components/DeliveryList';
import { DeliverySheet } from '../components/DeliverySheet';
import { ShiftSheet } from '../components/ShiftSheet';
import { Row, useToast } from '../components/ui';

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

/** BILAN QUOTIDIEN : rapport financier + correction complète de la journée. */
export function Report({ date: routeDate }: { date?: string }) {
  const { today, shifts, deliveries, payouts, ledger, now } = useData();
  const date = routeDate && /^\d{4}-\d{2}-\d{2}$/.test(routeDate) ? routeDate : today;
  const s = useMemo(() => summarizeDay(date, shifts, deliveries, now), [date, shifts, deliveries, now]);
  const report = useMemo(() => buildDailyReport(s, ledger, payouts), [s, ledger, payouts]);
  const toast = useToast();
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [addShift, setAddShift] = useState<string | null>(null);
  const [addDelivery, setAddDelivery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dayDeliveries = deliveries.filter((d) => d.date === date);

  const go = (d: string) => navigate(`bilan/${d}`);

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between p-2">
        <button aria-label="Journée précédente" className="rounded-xl p-3 active:bg-slate-100 dark:active:bg-white/10" onClick={() => go(addDays(date, -1))}>
          <ChevronLeft />
        </button>
        <label className="relative flex-1 text-center">
          <span className="text-xs font-bold uppercase tracking-widest muted">Bilan quotidien</span>
          <span className="block font-bold">{formatDateLong(date)}</span>
          <input type="date" aria-label="Choisir la date" className="absolute inset-0 opacity-0" value={date} onChange={(e) => e.target.value && go(e.target.value)} />
        </label>
        <button aria-label="Journée suivante" className="rounded-xl p-3 active:bg-slate-100 dark:active:bg-white/10" onClick={() => go(addDays(date, 1))}>
          <ChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm [&>button]:whitespace-nowrap [&>button]:px-2 sm:grid-cols-4">
        <button
          className="btn-primary"
          onClick={async () => {
            await copyText(reportToText(report));
            toast({ text: 'Rapport copié — collez-le dans un message', tone: 'ok' });
          }}
        >
          <Copy size={18} /> Copier le rapport
        </button>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { exportReportPdf } = await import('../lib/pdf');
              await exportReportPdf(report);
            } catch (e) {
              toast({ text: 'Erreur PDF : ' + (e as Error).message, tone: 'error' });
            } finally {
              setBusy(false);
            }
          }}
        >
          <FileDown size={18} /> Exporter en PDF
        </button>
        {typeof navigator.share === 'function' && (
          <button className="btn-ghost" onClick={() => navigator.share({ title: `Bilan du ${formatDateLong(date)}`, text: reportToText(report) }).catch(() => {})}>
            <Share2 size={18} /> Partager
          </button>
        )}
        <button className={`btn-ghost ${typeof navigator.share === 'function' ? '' : 'col-span-2 sm:col-span-1'}`} onClick={() => navigate('historique')}>
          <History size={18} /> Consulter l'historique
        </button>
      </div>

      <article className="card p-5" data-testid="report">
        <header className="mb-2 border-b border-slate-100 pb-3 dark:border-white/5">
          <div className="text-xs font-bold uppercase tracking-widest muted">{report.title}</div>
          <div className="text-xl font-extrabold">DATE : {formatDateLong(date)}</div>
          {s.active && <div className="mt-1 text-xs font-semibold text-emerald-500">Quart en cours — montants provisoires</div>}
        </header>
        {report.sections.map((sec) => (
          <section key={sec.title} className="border-b border-slate-100 py-3 last:border-0 dark:border-white/5">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">{sec.title}</h3>
            <div className="text-sm">
              {sec.rows.map(([k, v], i) => (
                <Row key={i} k={k} v={v} />
              ))}
              {sec.total && <Row k={sec.total[0]} v={sec.total[1]} strong tone={sec.title.startsWith('VERSEMENTS') || sec.title.startsWith('SOLDE') ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'} />}
            </div>
          </section>
        ))}
        <p className="mt-2 text-xs muted">{report.note}</p>
      </article>

      <h2 className="section-title">Corriger la journée — quarts</h2>
      <div className="card divide-y divide-slate-100 dark:divide-white/5">
        {s.shifts.map((sh) => (
          <button key={sh.id} className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-slate-50 dark:active:bg-white/5" onClick={() => setEditShift(sh)}>
            <span>
              <span className="font-semibold">
                {timeFr(sh.start)} → {sh.end ? timeFr(sh.end) : 'en cours'}
              </span>
              <span className="block text-xs muted">
                {formatDuration(workedMs(sh, now))} rémunérées · {formatMoney(sh.hourlyRate)}/h
              </span>
            </span>
            <Pencil size={16} className="muted" />
          </button>
        ))}
        <button className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-indigo-500" onClick={() => setAddShift(date)}>
          <PlusCircle size={16} /> Ajouter un quart à cette journée
        </button>
      </div>

      <h2 className="section-title">Corriger la journée — livraisons ({dayDeliveries.length})</h2>
      <DeliveryList deliveries={dayDeliveries} />
      <button className="btn-ghost w-full" onClick={() => setAddDelivery(date)}>
        <PlusCircle size={18} /> Ajouter une livraison oubliée
      </button>

      <ShiftSheet shift={editShift} newForDate={addShift} onClose={() => { setEditShift(null); setAddShift(null); }} />
      <DeliverySheet delivery={null} newForDate={addDelivery} onClose={() => setAddDelivery(null)} />
    </div>
  );
}
