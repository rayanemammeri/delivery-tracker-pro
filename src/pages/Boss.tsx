import { useEffect, useState } from 'react';
import { CheckCircle2, HandCoins, Pencil, Trash2 } from 'lucide-react';
import { addPayout, deletePayout, updatePayout } from '../db/repo';
import { useData } from '../hooks/data';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { dateKey, formatDateLong, formatDateShort } from '../lib/time';
import type { Payout } from '../lib/types';
import { Empty, Sheet, Stat, useConfirmYesNo, useToast } from '../components/ui';
import { navigate } from '../lib/router';

/**
 * POURBOIRES MACHINE REMIS PAR LE PATRON.
 * Rien n'est jamais marqué comme remis automatiquement : chaque remise est saisie ici.
 */
export function Boss() {
  const { ledger, payouts } = useData();
  const [form, setForm] = useState<{ open: boolean; edit: Payout | null }>({ open: false, edit: null });
  const days = [...ledger.byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
  const sorted = [...payouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const progress = ledger.totalAccrued > 0 ? Math.min(100, (Math.min(ledger.totalPaid, ledger.totalAccrued) / ledger.totalAccrued) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="card p-5">
        <div className="text-xs font-bold uppercase tracking-widest muted">Reste à recevoir du patron</div>
        <div className="mt-1 text-4xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400" data-testid="boss-due">{formatMoney(ledger.totalDue)}</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1 text-xs muted">{Math.round(progress)} % des pourboires machine remis</div>
        {ledger.credit > 0 && <div className="mt-2 rounded-lg bg-sky-500/10 px-3 py-2 text-sm text-sky-600 dark:text-sky-400">Avance du patron : {formatMoney(ledger.credit)} (remis en plus du dû)</div>}
        <button className="btn-primary mt-4 w-full" onClick={() => setForm({ open: true, edit: null })} data-testid="add-payout">
          <HandCoins size={20} /> Enregistrer une remise
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Machine accumulés" value={formatMoney(ledger.totalAccrued)} tone="machine" />
        <Stat label="Déjà remis" value={formatMoney(ledger.totalPaid)} tone="cash" />
      </div>
      <p className="px-1 text-xs muted">Les pourboires CASH sont reçus directement et ne font jamais partie des montants dus par le patron.</p>

      <h2 className="section-title">Historique des remises</h2>
      {sorted.length === 0 ? (
        <Empty>Aucune remise enregistrée.</Empty>
      ) : (
        <ul className="card divide-y divide-slate-100 dark:divide-white/5">
          {sorted.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />
              <div className="flex-1">
                <div className="font-semibold">{formatDateLong(p.date)}</div>
                <div className="text-xs muted">
                  {p.forDate ? `Pour la journée du ${formatDateShort(p.forDate)}` : 'Plus anciens montants en premier'}
                  {p.note && ` · ${p.note}`}
                </div>
              </div>
              <div className="font-bold tabular-nums">{formatMoney(p.amount)}</div>
              <button aria-label="Modifier la remise" className="p-2 muted" onClick={() => setForm({ open: true, edit: p })}>
                <Pencil size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Détail par journée</h2>
      {days.length === 0 ? (
        <Empty>Aucun pourboire machine pour l'instant.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-4 gap-2 border-b border-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide muted dark:border-white/5">
            <span>Journée</span>
            <span className="text-right">Accumulé</span>
            <span className="text-right">Remis</span>
            <span className="text-right">Reste</span>
          </div>
          {days.map((d) => (
            <button key={d.date} onClick={() => navigate(`bilan/${d.date}`)} className="grid w-full grid-cols-4 gap-2 px-4 py-3 text-left text-sm tabular-nums active:bg-slate-50 dark:active:bg-white/5">
              <span className="font-medium">{formatDateShort(d.date)}</span>
              <span className="text-right">{formatMoney(d.accrued)}</span>
              <span className="text-right text-emerald-600 dark:text-emerald-400">{formatMoney(d.paid)}</span>
              <span className={`text-right font-semibold ${d.due > 0 ? 'text-amber-600 dark:text-amber-400' : 'muted'}`}>{d.due > 0 ? formatMoney(d.due) : '✓'}</span>
            </button>
          ))}
        </div>
      )}

      <PayoutSheet open={form.open} edit={form.edit} onClose={() => setForm({ open: false, edit: null })} />
    </div>
  );
}

function PayoutSheet({ open, edit, onClose }: { open: boolean; edit: Payout | null; onClose: () => void }) {
  const { ledger } = useData();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dateKey(new Date()));
  const [forDate, setForDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirmYesNo();
  const dueDays = [...ledger.byDay.values()].filter((d) => d.due > 0 || d.date === edit?.forDate).sort((a, b) => b.date.localeCompare(a.date));

  useEffect(() => {
    if (!open) return;
    setAmount(edit ? centsToInput(edit.amount) : ledger.totalDue > 0 ? centsToInput(ledger.totalDue) : '');
    setDate(edit?.date ?? dateKey(new Date()));
    setForDate(edit?.forDate ?? '');
    setNote(edit?.note ?? '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, edit]);

  const save = async () => {
    const cents = parseMoney(amount);
    if (!cents || cents <= 0) return setError('Entrez un montant supérieur à 0');
    if (!date) return setError('Date requise');
    try {
      if (edit) await updatePayout(edit.id, { amount: cents, date, forDate: forDate || null, note });
      else await addPayout({ amount: cents, date, forDate: forDate || null, note });
      toast({ text: `Remise de ${formatMoney(cents)} enregistrée`, tone: 'ok' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={edit ? 'Modifier la remise' : 'Remise du patron'}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="p-amount">Montant remis ($)</label>
          <input id="p-amount" className="field text-2xl font-bold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          {!edit && <p className="mt-1 text-xs muted">Reste dû actuellement : {formatMoney(ledger.totalDue)}. Une remise partielle est possible.</p>}
        </div>
        <div>
          <label className="label" htmlFor="p-date">Date de remise</label>
          <input id="p-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-for">Appliquer à</label>
          <select id="p-for" className="field" value={forDate} onChange={(e) => setForDate(e.target.value)}>
            <option value="">Les plus anciens montants dus en premier</option>
            {dueDays.map((d) => (
              <option key={d.date} value={d.date}>
                Journée du {formatDateShort(d.date)} (reste {formatMoney(d.due)})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-note">Note (optionnel)</label>
          <input id="p-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. remis en main propre" />
        </div>
        {error && <p className="text-sm font-medium text-rose-500">{error}</p>}
        <div className="flex gap-3">
          {edit && (
            <button
              className="btn-danger"
              aria-label="Supprimer la remise"
              onClick={async () => {
                if (!(await confirm('Supprimer cette remise ?', 'Supprimer la remise', { message: `${formatMoney(edit.amount)} redeviendront dus par le patron.`, danger: true }))) return;
                await deletePayout(edit.id);
                toast({ text: 'Remise supprimée', tone: 'ok' });
                onClose();
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button className="btn-primary flex-1" onClick={() => void save()} data-testid="save-payout">
            Confirmer la remise
          </button>
        </div>
      </div>
    </Sheet>
  );
}
