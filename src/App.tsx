import { lazy, Suspense, useEffect } from 'react';
import { BarChart3, FileText, HandCoins, History as HistoryIcon, Home, Settings as Cog } from 'lucide-react';
import { useData } from './hooks/data';
import { navigate, useRoute } from './lib/router';
import { applyTheme } from './lib/theme';
import { formatMoney } from './lib/money';
import { Today } from './pages/Today';
import { Boss } from './pages/Boss';
import { Report } from './pages/Report';
import { History } from './pages/History';
import { Settings } from './pages/Settings';

// Les graphiques sont chargés à la demande pour un démarrage plus rapide.
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })));

const TABS = [
  { path: '', label: "Aujourd'hui", icon: Home },
  { path: 'patron', label: 'Patron', icon: HandCoins },
  { path: 'bilan', label: 'Bilan', icon: FileText },
  { path: 'historique', label: 'Historique', icon: HistoryIcon },
  { path: 'stats', label: 'Stats', icon: BarChart3 },
];

const TITLES: Record<string, string> = {
  '': 'Delivery Tracker Pro',
  patron: 'Pourboires machine',
  bilan: 'Bilan quotidien',
  historique: 'Historique',
  stats: 'Statistiques',
  reglages: 'Réglages',
};

export default function App() {
  const route = useRoute();
  const { ready, settings, ledger } = useData();
  const page = route[0] ?? '';

  useEffect(() => {
    if (ready) applyTheme(settings.theme); // attendre les réglages pour ne pas écraser le thème choisi
  }, [ready, settings.theme]);
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [settings.theme]);

  let content;
  if (!ready) content = <div className="py-20 text-center muted">Chargement…</div>;
  else if (page === 'patron') content = <Boss />;
  else if (page === 'bilan') content = <Report date={route[1]} />;
  else if (page === 'historique') content = <History />;
  else if (page === 'stats') content = <Suspense fallback={<div className="py-20 text-center muted">Chargement…</div>}><Stats /></Suspense>;
  else if (page === 'reglages') content = <Settings />;
  else content = <Today />;

  return (
    <div className="mx-auto min-h-screen max-w-2xl">
      <header className="pt-safe sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/80 backdrop-blur-xl dark:border-white/5 dark:bg-[#0b0f17]/80">
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-extrabold tracking-tight">{TITLES[page] ?? TITLES['']}</h1>
          <div className="flex items-center gap-1">
            {ledger.totalDue > 0 && page !== 'patron' && (
              <button onClick={() => navigate('patron')} className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400" aria-label="Montant dû par le patron">
                Dû {formatMoney(ledger.totalDue)}
              </button>
            )}
            <button aria-label="Réglages" onClick={() => navigate('reglages')} className={`rounded-full p-2.5 ${page === 'reglages' ? 'text-indigo-500' : 'muted'}`}>
              <Cog size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pb-32 pt-3" key={page}>
        <div className="animate-pop">{content}</div>
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-white/5 dark:bg-[#0e131d]/85" aria-label="Navigation principale">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((t) => {
            const active = page === t.path;
            const Icon = t.icon;
            return (
              <button key={t.path} onClick={() => navigate(t.path)} aria-current={active ? 'page' : undefined} className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                <Icon size={23} strokeWidth={active ? 2.5 : 2} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
