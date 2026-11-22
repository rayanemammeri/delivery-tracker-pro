import { Banknote, CreditCard } from 'lucide-react';
import type { PaymentMethod } from '../lib/types';

/** Deux grandes options visuelles : CASH / MACHINE. */
export function MethodPicker({ value, onChange, size = 'lg' }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; size?: 'lg' | 'md' }) {
  const base = `flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 font-extrabold tracking-wide transition active:scale-[0.97] ${size === 'lg' ? 'h-16 text-lg' : 'h-12'}`;
  return (
    <div className="flex gap-3" role="radiogroup" aria-label="Mode de paiement">
      <button
        type="button"
        role="radio"
        aria-checked={value === 'cash'}
        onClick={() => onChange('cash')}
        className={`${base} ${value === 'cash' ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300'}`}
      >
        <Banknote size={22} /> CASH
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'machine'}
        onClick={() => onChange('machine')}
        className={`${base} ${value === 'machine' ? 'border-indigo-500 bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300'}`}
      >
        <CreditCard size={22} /> MACHINE
      </button>
    </div>
  );
}
