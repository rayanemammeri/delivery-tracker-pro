import { useData } from '../hooks/data';
import { dayBalance, summarizeDay } from '../lib/calc';
import { formatDateWeekday } from '../lib/time';
import { DeliveryList } from '../components/DeliveryList';
import { Kpis } from '../components/Kpis';
import { QuickAdd } from '../components/QuickAdd';
import { ShiftCard } from '../components/ShiftCard';
import { TipSplit } from '../components/TipSplit';

export function Today() {
  const { today, shifts, deliveries, ledger, now } = useData();
  const s = summarizeDay(today, shifts, deliveries, now);
  const list = deliveries.filter((d) => d.date === today);
  return (
    <div className="space-y-3">
      <p className="px-1 text-sm font-medium muted first-letter:uppercase">{formatDateWeekday(today)}</p>
      <ShiftCard />
      <QuickAdd />
      <h2 className="section-title">Tableau de bord</h2>
      <Kpis s={s} />
      <TipSplit s={s} bal={dayBalance(ledger, today)} globalDue={ledger.totalDue} />
      <h2 className="section-title">Livraisons de la journée ({list.length})</h2>
      <DeliveryList deliveries={list} emptyText="Aucune livraison pour l'instant. Saisissez le pourboire ci-dessus après chaque livraison." />
    </div>
  );
}
