import { useState } from 'react';
import { Coffee, Pencil, Play, PlusCircle, Square } from 'lucide-react';
import { endShift, startShift, toggleBreak } from '../db/repo';
import { useData } from '../hooks/data';
import { breakMs, isOnBreak, shiftSalary, workedMs } from '../lib/calc';
import { formatMoney } from '../lib/money';
import { formatClock, formatDuration, timeFr } from '../lib/time';
import type { Shift } from '../lib/types';
import { ShiftSheet } from './ShiftSheet';
import { useToast } from './ui';

/** Boutons COMMENCER / TERMINER LE TRAVAIL, chronomètre, pause et correction. */
export function ShiftCard() {
  const { activeShift, now, shifts, today } = useData();
  const [editing, setEditing] = useState<Shift | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const toast = useToast();
  const doneToday = shifts.filter((s) => s.date === today && s.end).sort((a, b) => a.start.localeCompare(b.start));

  if (!activeShift) {
    return (
      <section className="card p-4">
        <button
          data-testid="start-shift"
          className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-lg font-extrabold tracking-wide text-white shadow-lg shadow-emerald-500/25 transition active:scale-[0.98]"
          onClick={async () => {
            const s = await startShift();
            toast({ text: `Travail commencé à ${timeFr(s.start)}`, tone: 'ok' });
          }}
        >
          <Play size={22} fill="currentColor" /> COMMENCER LE TRAVAIL
        </button>
        {doneToday.length > 0 && (
          <div className="mt-3 space-y-1">
            {doneToday.map((s) => (
              <button key={s.id} onClick={() => setEditing(s)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm active:bg-slate-50 dark:active:bg-white/5">
                <span className="muted">
                  Quart {timeFr(s.start)} → {timeFr(s.end!)} · {formatDuration(workedMs(s, now))}
                </span>
                <span className="flex items-center gap-2 font-semibold">
                  {formatMoney(shiftSalary(s, now))} <Pencil size={14} className="muted" />
                </span>
              </button>
            ))}
          </div>
        )}
        <button className="mt-2 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-indigo-500" onClick={() => setAdding(today)}>
          <PlusCircle size={16} /> Saisir un quart manuellement
        </button>
        <ShiftSheet shift={editing} newForDate={adding} onClose={() => { setEditing(null); setAdding(null); }} />
      </section>
    );
  }

  const onBreak = isOnBreak(activeShift);
  return (
    <section className="card overflow-hidden">
      <div className={`p-4 ${onBreak ? 'bg-amber-500/10' : 'bg-emerald-500/[0.07]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <span className={`h-2.5 w-2.5 rounded-full ${onBreak ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'}`} />
            <span className={onBreak ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>{onBreak ? 'En pause' : 'En service'}</span>
          </div>
          <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-500" onClick={() => setEditing(activeShift)}>
            <Pencil size={14} /> Corriger
          </button>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-4xl font-extrabold tabular-nums tracking-tight" data-testid="shift-clock">{formatClock(workedMs(activeShift, now))}</div>
            <div className="mt-1 text-xs muted">
              Début {timeFr(activeShift.start)}
              {breakMs(activeShift, now) > 0 && ` · pauses ${formatDuration(breakMs(activeShift, now))}`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs muted">Salaire</div>
            <div className="text-xl font-bold tabular-nums">{formatMoney(shiftSalary(activeShift, now))}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-3 p-4 pt-3">
        <button className="btn-ghost h-14" onClick={() => void toggleBreak()}>
          <Coffee size={18} /> {onBreak ? 'Reprendre' : 'Pause'}
        </button>
        <button
          data-testid="end-shift"
          className="btn h-14 whitespace-nowrap bg-rose-600 text-[15px] font-extrabold tracking-wide text-white"
          onClick={async () => {
            if (!window.confirm('Terminer le travail maintenant ?')) return;
            await endShift();
            toast({ text: 'Travail terminé — bilan disponible', tone: 'ok' });
          }}
        >
          <Square size={18} fill="currentColor" /> TERMINER LE TRAVAIL
        </button>
      </div>
      <ShiftSheet shift={editing} onClose={() => setEditing(null)} />
    </section>
  );
}
