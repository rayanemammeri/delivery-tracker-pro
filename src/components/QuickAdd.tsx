import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Plus } from 'lucide-react';
import { addDelivery, deleteDelivery } from '../db/repo';
import { useData } from '../hooks/data';
import { formatMoney } from '../lib/money';
import type { PaymentMethod } from '../lib/types';
import { MethodPicker } from './MethodPicker';
import { useToast } from './ui';

const MAX = 99999; // 999,99 $
const PRESETS = [200, 300, 400, 500, 1000];

/**
 * Saisie ultra-rapide : on tape les chiffres comme sur une caisse (5-5-0 = 5,50 $),
 * on choisit CASH ou MACHINE, puis AJOUTER. Le mode choisi est mémorisé pour la prochaine fois.
 * Au clavier (ordinateur) : chiffres, Retour arrière, C = cash, M = machine, Entrée = ajouter.
 */
export function QuickAdd() {
  const { settings, deliveries, today } = useData();
  const [cents, setCents] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>(settings.defaultMethod);
  const [flash, setFlash] = useState(false);
  const busy = useRef(false);
  const toast = useToast();
  const methodTouched = useRef(false);

  useEffect(() => {
    if (!methodTouched.current) setMethod(settings.defaultMethod);
  }, [settings.defaultMethod]);

  const press = (d: number | '00') => setCents((c) => {
    const n = d === '00' ? c * 100 : c * 10 + d;
    return n > MAX ? c : n;
  });
  const back = () => setCents((c) => Math.floor(c / 10));

  const submit = useCallback(async () => {
    if (busy.current) return; // anti double-tap → aucun doublon
    busy.current = true;
    try {
      const d = await addDelivery(cents, method);
      const n = deliveries.filter((x) => x.date === d.date).length + 1;
      setCents(0);
      setFlash(true);
      setTimeout(() => setFlash(false), 350);
      if (navigator.vibrate) navigator.vibrate(15);
      toast({
        text: `Livraison n° ${n} : ${formatMoney(d.amount)} ${d.method === 'cash' ? 'CASH' : 'MACHINE'}`,
        tone: 'ok',
        action: { label: 'Annuler', run: () => void deleteDelivery(d.id) },
      });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setTimeout(() => (busy.current = false), 350);
    }
  }, [cents, method, deliveries, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') || document.querySelector('[role=dialog]')) return;
      if (/^[0-9]$/.test(e.key)) press(Number(e.key));
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') void submit();
      else if (e.key.toLowerCase() === 'c') setMethod('cash');
      else if (e.key.toLowerCase() === 'm') setMethod('machine');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit]);

  const count = deliveries.filter((d) => d.date === today).length;
  const key = 'flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-semibold active:scale-95 active:bg-slate-200 dark:bg-white/[0.06] dark:active:bg-white/10 transition select-none';

  return (
    <section className="card p-4" aria-label="Ajout rapide d'une livraison">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest muted">Nouvelle livraison · n° {count + 1}</h2>
        {cents > 0 && (
          <button className="text-xs font-semibold text-indigo-500" onClick={() => setCents(0)}>
            Effacer
          </button>
        )}
      </div>
      <div
        data-testid="amount-display"
        className={`my-3 text-center text-5xl font-extrabold tabular-nums tracking-tight transition ${flash ? 'scale-105 text-emerald-500' : ''} ${cents === 0 ? 'text-slate-300 dark:text-slate-600' : ''}`}
      >
        {formatMoney(cents)}
      </div>

      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => setCents(p)} className="h-10 flex-1 shrink-0 rounded-full border border-slate-200 px-3 text-sm font-semibold active:scale-95 dark:border-white/10">
            {p / 100} $
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="Pavé numérique">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} className={key} onClick={() => press(n)} aria-label={String(n)}>
            {n}
          </button>
        ))}
        <button className={key} onClick={() => press('00')} aria-label="00">
          00
        </button>
        <button className={key} onClick={() => press(0)} aria-label="0">
          0
        </button>
        <button className={key} onClick={back} aria-label="Effacer un chiffre">
          <Delete size={24} />
        </button>
      </div>

      <div className="mt-4">
        <MethodPicker
          value={method}
          onChange={(m) => {
            methodTouched.current = true;
            setMethod(m);
          }}
        />
      </div>

      <button
        onClick={() => void submit()}
        data-testid="add-delivery"
        className={`mt-3 flex h-16 w-full items-center justify-center gap-2 rounded-2xl text-lg font-extrabold tracking-wide text-white shadow-lg transition active:scale-[0.98] ${
          method === 'cash' ? 'bg-emerald-600 shadow-emerald-600/25' : 'bg-indigo-600 shadow-indigo-600/25'
        }`}
      >
        <Plus size={24} strokeWidth={3} /> AJOUTER {cents > 0 ? formatMoney(cents) : '(sans pourboire)'}
      </button>
    </section>
  );
}
