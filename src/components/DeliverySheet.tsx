import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { addDelivery, deleteDelivery, restoreDelivery, updateDelivery } from '../db/repo';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { combineWorkday, timeHM } from '../lib/time';
import type { Delivery, PaymentMethod } from '../lib/types';
import { MethodPicker } from './MethodPicker';
import { Sheet, useToast } from './ui';

/** Modifier / supprimer une livraison existante, ou en ajouter une pour une journée passée. */
export function DeliverySheet({ delivery, newForDate, onClose }: { delivery: Delivery | null; newForDate?: string | null; onClose: () => void }) {
  const open = !!delivery || !!newForDate;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (delivery) {
      setAmount(centsToInput(delivery.amount));
      setMethod(delivery.method);
      setDate(delivery.date);
      setTime(timeHM(delivery.time));
    } else if (newForDate) {
      setAmount('');
      setMethod('cash');
      setDate(newForDate);
      setTime('18:00');
    }
    setError('');
  }, [delivery, newForDate]);

  const save = async () => {
    const cents = parseMoney(amount || '0');
    if (cents == null) return setError('Montant invalide (ex. 5,50)');
    if (!date || !time) return setError('Date et heure requises');
    const at = combineWorkday(date, time);
    try {
      if (delivery) {
        // On ne réécrit l'heure que si elle a été modifiée (sinon on garde la précision à la seconde).
        const timeChanged = time !== timeHM(delivery.time) || date !== delivery.date;
        await updateDelivery(delivery.id, { amount: cents, method, date, ...(timeChanged ? { time: at.toISOString() } : {}) });
        toast({ text: 'Livraison modifiée', tone: 'ok' });
      } else {
        await addDelivery(cents, method, at, date);
        toast({ text: `Livraison ajoutée : ${formatMoney(cents)}`, tone: 'ok' });
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!delivery) return;
    const d = await deleteDelivery(delivery.id);
    onClose();
    toast({ text: 'Livraison supprimée', tone: 'ok', action: d ? { label: 'Annuler', run: () => void restoreDelivery(d) } : undefined });
  };

  return (
    <Sheet open={open} onClose={onClose} title={delivery ? 'Modifier la livraison' : 'Ajouter une livraison'}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="d-amount">Pourboire ($)</label>
          <input id="d-amount" className="field text-2xl font-bold" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} data-autofocus />
        </div>
        <MethodPicker value={method} onChange={setMethod} size="md" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="d-date">Journée</label>
            <input id="d-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="d-time">Heure</label>
            <input id="d-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <p className="text-xs muted">Une heure entre minuit et 5 h est rattachée à la journée choisie (après minuit).</p>
        {error && <p className="text-sm font-medium text-rose-500">{error}</p>}
        <div className="flex gap-3">
          {delivery && (
            <button className="btn-danger" onClick={() => void remove()} aria-label="Supprimer">
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
