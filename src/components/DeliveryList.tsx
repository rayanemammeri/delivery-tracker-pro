import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Delivery } from '../lib/types';
import { formatMoney } from '../lib/money';
import { timeHM } from '../lib/time';
import { DeliverySheet } from './DeliverySheet';
import { Empty, MethodBadge } from './ui';

/** Liste complète des livraisons d'une journée — toucher une ligne pour la modifier ou la supprimer. */
export function DeliveryList({ deliveries, emptyText = 'Aucune livraison pour cette journée.' }: { deliveries: Delivery[]; emptyText?: string }) {
  const [editing, setEditing] = useState<Delivery | null>(null);
  const sorted = [...deliveries].sort((a, b) => a.time.localeCompare(b.time));
  if (sorted.length === 0) return <Empty>{emptyText}</Empty>;
  return (
    <>
      <ul className="card divide-y divide-slate-100 overflow-hidden dark:divide-white/5" data-testid="delivery-list">
        {sorted
          .map((d, i) => ({ d, n: i + 1 }))
          .reverse()
          .map(({ d, n }) => (
            <li key={d.id}>
              <button className="flex w-full animate-pop items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-white/5" onClick={() => setEditing(d)}>
                <span className="w-8 text-sm font-semibold muted">#{n}</span>
                <span className="w-12 text-sm tabular-nums muted">{timeHM(d.time)}</span>
                <MethodBadge method={d.method} />
                <span className="flex-1 text-right text-lg font-bold tabular-nums">{formatMoney(d.amount)}</span>
                <ChevronRight size={18} className="muted" />
              </button>
            </li>
          ))}
      </ul>
      <DeliverySheet delivery={editing} onClose={() => setEditing(null)} />
    </>
  );
}
