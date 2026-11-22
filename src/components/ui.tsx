import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

// ───────────── Notifications (toast) avec action « Annuler » ─────────────
interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
  action?: { label: string; run: () => void };
}
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.action ? 5000 : 2500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ bottom: 'calc(84px + var(--safe-bottom))' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-md animate-up items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ${
              t.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
            }`}
          >
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button
                className="rounded-lg px-2 py-1 font-bold text-indigo-300 dark:text-indigo-600"
                onClick={() => {
                  t.action!.run();
                  setToasts((ts) => ts.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ───────────── Feuille modale (style iOS) ─────────────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} className="relative max-h-[92vh] w-full max-w-lg animate-up overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe shadow-2xl dark:bg-[#121826] sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Fermer" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}

// ───────────── Tuile de statistique ─────────────
export function Stat({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone?: 'cash' | 'machine' | 'accent' | 'warn'; icon?: ReactNode }) {
  const color =
    tone === 'cash' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'machine' ? 'text-indigo-600 dark:text-indigo-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : '';
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums tracking-tight ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs muted">{sub}</div>}
    </div>
  );
}

export function Row({ k, v, strong, tone }: { k: ReactNode; v: ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 ${strong ? 'font-bold' : ''}`}>
      <span className={strong ? '' : 'muted'}>{k}</span>
      <span className={`text-right tabular-nums ${tone ?? ''}`}>{v}</span>
    </div>
  );
}

export function MethodBadge({ method }: { method: 'cash' | 'machine' }) {
  return method === 'cash' ? (
    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Cash</span>
  ) : (
    <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Machine</span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-8 text-center text-sm muted">{children}</div>;
}

export function confirmAction(msg: string): boolean {
  return window.confirm(msg);
}
