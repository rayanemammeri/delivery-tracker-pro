import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/*
 * Composants d'interface communs, construits sur les éléments natifs modernes du navigateur
 * (recommandations « Modern Web Guidance » de Chrome / Edge / Firefox / MDN) :
 *  - <dialog> ouvert avec showModal() pour les feuilles et les confirmations : focus, touche Échap,
 *    geste retour, page inerte et retour du focus sont gérés par le navigateur ;
 *  - popover="manual" pour les notifications (couche supérieure, non fermées par un clic ailleurs) ;
 *  - ariaNotify() (ou une zone aria-live en repli) pour annoncer les notifications aux lecteurs d'écran.
 */

const supportsPopover = typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');
const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

/** Annonce un message aux lecteurs d'écran : ariaNotify() si disponible, sinon zone aria-live. */
function announce(text: string) {
  const doc = document as Document & { ariaNotify?: (msg: string) => void };
  if (typeof doc.ariaNotify === 'function') {
    doc.ariaNotify(text);
    return;
  }
  const live = document.getElementById('sr-announcer');
  if (live) {
    live.textContent = '';
    // petit délai pour que le changement soit bien détecté
    setTimeout(() => (live.textContent = text), 50);
  }
}

/**
 * Fermeture par clic sur le fond (« light dismiss ») : native via closedby="any",
 * avec repli pour les navigateurs qui ne la gèrent pas encore (Safari).
 */
function useLightDismissFallback(ref: React.RefObject<HTMLDialogElement>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || supportsClosedBy) return;
    // On teste la position du pointeur, pas event.target : le <dialog> est aussi la cible de son propre padding.
    const outside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const down = (e: PointerEvent) => (pressedOutside = outside(e));
    // Appui ET relâchement à l'extérieur : un glissement qui finit sur le fond ne ferme pas.
    const up = (e: PointerEvent) => {
      if (pressedOutside && outside(e)) dialog.close();
    };
    dialog.addEventListener('pointerdown', down);
    dialog.addEventListener('pointerup', up);
    return () => {
      dialog.removeEventListener('pointerdown', down);
      dialog.removeEventListener('pointerup', up);
    };
  }, [ref]);
}

/** Ouvre / ferme un <dialog> modal selon `open` et prévient le parent quand le navigateur le ferme (Échap, fond…). */
function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Focus initial sur l'élément marqué (équivalent de l'attribut autofocus).
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onDialogClose = () => {
      if (openRef.current) onCloseRef.current();
    };
    d.addEventListener('close', onDialogClose);
    return () => d.removeEventListener('close', onDialogClose);
  }, []);

  useLightDismissFallback(ref);
  return ref;
}

// ───────────── Feuille modale (style iOS) ─────────────
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  return (
    <dialog ref={ref} className="sheet" aria-labelledby={titleId} {...({ closedby: 'any' } as object)}>
      <div className="max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe shadow-2xl dark:bg-[#121826] sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" aria-label="Fermer" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </dialog>
  );
}

// ───────────── Boîte de confirmation (remplace window.confirm) ─────────────
interface ConfirmAction {
  value: string;
  label: string;
  tone?: 'danger' | 'primary' | 'ghost';
}
interface ConfirmOptions {
  title: string;
  message?: string;
  /** Une ou plusieurs actions ; « Annuler » est toujours ajouté et reçoit le focus (action sûre). */
  actions: ConfirmAction[];
  cancelLabel?: string;
}
type Ask = (o: ConfirmOptions) => Promise<string>;
const ConfirmCtx = createContext<Ask>(async () => '');

/** Pose une question ; renvoie la valeur de l'action choisie, ou '' si annulé / fermé. */
export const useConfirm = () => useContext(ConfirmCtx);

/** Raccourci pour une confirmation oui / non. */
export function useConfirmYesNo() {
  const ask = useConfirm();
  return useCallback(
    async (title: string, confirmLabel: string, opts: { message?: string; danger?: boolean } = {}) =>
      (await ask({ title, message: opts.message, actions: [{ value: 'ok', label: confirmLabel, tone: opts.danger ? 'danger' : 'primary' }] })) === 'ok',
    [ask],
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<(ConfirmOptions & { resolve: (v: string) => void }) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const msgId = useId();
  useLightDismissFallback(ref);

  const ask = useCallback<Ask>(
    (o) =>
      new Promise((resolve) => {
        setReq({ ...o, resolve });
      }),
    [],
  );

  useEffect(() => {
    const d = ref.current;
    if (d && req && !d.open) {
      d.returnValue = '';
      d.showModal();
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
  }, [req]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClose = () => {
      // Échap / fond : pas de valeur → '' (= annulé). On remet returnValue à zéro pour la prochaine fois.
      const v = d.returnValue;
      d.returnValue = '';
      setReq((cur) => {
        cur?.resolve(v === 'cancel' ? '' : v);
        return null;
      });
    };
    d.addEventListener('close', onClose);
    return () => d.removeEventListener('close', onClose);
  }, []);

  const toneClass = (t?: ConfirmAction['tone']) => (t === 'danger' ? 'btn-danger' : t === 'ghost' ? 'btn-ghost' : 'btn-primary');

  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <dialog ref={ref} className="confirm" aria-labelledby={titleId} aria-describedby={req?.message ? msgId : undefined} {...({ closedby: 'any' } as object)}>
        <div className="w-[min(92vw,24rem)] rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#121826]">
          <h2 id={titleId} className="text-lg font-bold">
            {req?.title}
          </h2>
          {req?.message && (
            <p id={msgId} className="mt-2 whitespace-pre-line text-sm muted">
              {req.message}
            </p>
          )}
          <form method="dialog" className="mt-5 flex flex-col gap-2">
            {req?.actions.map((a) => (
              <button key={a.value} value={a.value} className={`${toneClass(a.tone)} w-full`}>
                {a.label}
              </button>
            ))}
            <button value="cancel" data-autofocus className="btn-ghost w-full">
              {req?.cancelLabel ?? 'Annuler'}
            </button>
          </form>
        </div>
      </dialog>
    </ConfirmCtx.Provider>
  );
}

// ───────────── Notifications (toast) avec action « Annuler » ─────────────
interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
  action?: { label: string; run: () => void };
}
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastItem({ t, index, onDismiss }: { t: Toast; index: number; onDismiss: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDismiss(t.id), t.action ? 5000 : 2800);
  }, [onDismiss, t.id, t.action]);

  useEffect(() => {
    const el = ref.current as (HTMLDivElement & { showPopover?: () => void }) | null;
    if (supportsPopover) el?.showPopover?.();
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <div
      ref={ref}
      {...(supportsPopover ? { popover: 'manual' } : {})}
      className={`toast flex animate-up items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ${
        t.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
      }`}
      style={{ bottom: `calc(84px + var(--safe-bottom) + ${index * 60}px)` }}
      // Ne pas faire disparaître la notification pendant qu'un bouton à l'intérieur a le focus.
      onFocus={() => clearTimeout(timer.current)}
      onBlur={start}
    >
      <span className="flex-1">{t.text}</span>
      {t.action && (
        <button
          type="button"
          className="rounded-lg px-2 py-1 font-bold text-indigo-300 dark:text-indigo-600"
          onClick={() => {
            t.action!.run();
            onDismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button type="button" aria-label="Fermer la notification" className="-mr-1 rounded-lg p-1 opacity-70" onClick={() => onDismiss(t.id)}>
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    // Seul le texte visible est annoncé ; on signale qu'une action est disponible.
    announce(t.action ? `${t.text}. Action disponible.` : t.text);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div role="region" aria-label="Notifications">
        {[...toasts].reverse().map((t, i) => (
          <ToastItem key={t.id} t={t} index={i} onDismiss={dismiss} />
        ))}
      </div>
      <p className="sr-only">Annonces pour lecteur d'écran</p>
      <div id="sr-announcer" className="sr-only" aria-live="polite" />
    </ToastCtx.Provider>
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
