import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteShift, saveShift, uid } from '../db/repo';
import { useData } from '../hooks/data';
import { breakMs, shiftSalary, workedMs } from '../lib/calc';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { buildShiftTimes, formatDuration, timeHM } from '../lib/time';
import type { Shift } from '../lib/types';
import { Row, Sheet, useConfirmYesNo, useToast } from './ui';

/**
 * Création / correction manuelle d'un quart : utile si on a oublié de démarrer ou d'arrêter
 * le chronomètre. Une heure de fin inférieure à l'heure de début = fin le lendemain (après minuit).
 */
export function ShiftSheet({ shift, newForDate, onClose }: { shift: Shift | null; newForDate?: string | null; onClose: () => void }) {
  const { settings, now } = useData();
  const open = !!shift || !!newForDate;
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [ongoing, setOngoing] = useState(false);
  const [pause, setPause] = useState('0');
  const [rate, setRate] = useState('12,00');
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirmYesNo();

  useEffect(() => {
    if (shift) {
      setDate(shift.date);
      setStart(timeHM(shift.start));
      setEnd(shift.end ? timeHM(shift.end) : '');
      setOngoing(!shift.end);
      setPause(String(Math.round(breakMs(shift, now) / 60000)));
      setRate(centsToInput(shift.hourlyRate));
    } else if (newForDate) {
      setDate(newForDate);
      setStart('16:00');
      setEnd('22:00');
      setOngoing(false);
      setPause('0');
      setRate(centsToInput(settings.hourlyRate));
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift, newForDate]);

  const draft = useMemo((): Shift | null => {
    if (!date || !start || (!ongoing && !end)) return null;
    const rateC = parseMoney(rate);
    const p = Number(pause);
    if (rateC == null || !Number.isFinite(p) || p < 0) return null;
    const { start: s, end: e } = buildShiftTimes(date, start, ongoing ? null : end);
    const origPause = shift ? Math.round(breakMs(shift, now) / 60000) : 0;
    const pauseChanged = !shift || p !== origPause;
    return {
      id: shift?.id ?? uid(),
      date,
      start: s.toISOString(),
      end: e ? e.toISOString() : null,
      breaks: shift?.breaks ?? [],
      // Si la pause n'a pas été modifiée, on garde les pauses chronométrées (y compris en cours).
      breakMinutes: pauseChanged ? Math.round(p) : shift!.breakMinutes,
      hourlyRate: rateC,
      createdAt: shift?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [date, start, end, ongoing, pause, rate, shift, now]);

  const nextDay = draft?.end && new Date(draft.end).getDate() !== new Date(draft.start).getDate();

  const save = async () => {
    if (!draft) return setError('Vérifiez les champs (heures, pause, taux).');
    if (draft.end && workedMs(draft) <= 0) return setError('La pause dépasse la durée du quart.');
    if (new Date(draft.start).getTime() > Date.now() + 60_000 && ongoing) return setError('Le début ne peut pas être dans le futur.');
    try {
      await saveShift(draft);
      toast({ text: shift ? 'Quart corrigé' : 'Quart ajouté', tone: 'ok' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!shift || !(await confirm('Supprimer ce quart de travail ?', 'Supprimer le quart', { message: 'Le salaire de ce quart sera retiré du bilan.', danger: true }))) return;
    await deleteShift(shift.id);
    toast({ text: 'Quart supprimé', tone: 'ok' });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={shift ? 'Corriger le quart' : 'Ajouter un quart'}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="s-date">Journée de travail</label>
          <input id="s-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <div>
            <label className="label" htmlFor="s-start">Début</label>
            <input id="s-start" type="time" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="s-end">Fin {nextDay && <span className="normal-case text-amber-500">(lendemain)</span>}</label>
            <input id="s-end" type="time" className="field" value={end} disabled={ongoing} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {shift && !shift.end && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} /> Quart toujours en cours
          </label>
        )}
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <div>
            <label className="label" htmlFor="s-pause">Pause non payée (min)</label>
            <input id="s-pause" className="field" inputMode="numeric" value={pause} onChange={(e) => setPause(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className="label" htmlFor="s-rate">Taux horaire ($)</label>
            <input id="s-rate" className="field" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
        </div>
        {draft && (
          <div className="rounded-xl bg-slate-50 px-4 py-1 dark:bg-white/[0.04]">
            <Row k="Temps rémunéré" v={formatDuration(workedMs(draft, now))} />
            <Row k="Salaire" v={formatMoney(shiftSalary(draft, now))} strong />
          </div>
        )}
        {error && <p className="text-sm font-medium text-rose-500">{error}</p>}
        <div className="flex gap-3">
          {shift && (
            <button className="btn-danger" onClick={() => void remove()} aria-label="Supprimer le quart">
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn-primary flex-1" onClick={() => void save()}>
            Enregistrer
          </button>
        </div>
      </div>
    </Sheet>
  );
}
