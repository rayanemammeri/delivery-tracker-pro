import { useEffect, useRef, useState } from 'react';
import { Database, Download, FileSpreadsheet, Moon, Smartphone, Sun, SunMoon, Trash2, Upload } from 'lucide-react';
import { exportBackup, importBackup, requestPersistence, saveSettings, wipeAll } from '../db/repo';
import { useData } from '../hooks/data';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { dateKey, timeHM } from '../lib/time';
import type { Settings as S } from '../lib/types';
import { applyTheme } from '../lib/theme';
import { useToast } from '../components/ui';

/** Télécharge un fichier ; sur iPhone propose la feuille de partage (Enregistrer dans Fichiers / iCloud). */
async function saveFile(name: string, content: string, type: string) {
  const file = new File([content], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch {
      /* annulé → téléchargement classique */
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Settings() {
  const { settings, deliveries, shifts, payouts } = useData();
  const [rate, setRate] = useState(centsToInput(settings.hourlyRate));
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => setRate(centsToInput(settings.hourlyRate)), [settings.hourlyRate]);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const setTheme = (theme: S['theme']) => {
    void saveSettings({ theme });
    applyTheme(theme);
  };

  const saveRate = async () => {
    const c = parseMoney(rate);
    if (c == null || c <= 0) return toast({ text: 'Taux invalide', tone: 'error' });
    await saveSettings({ hourlyRate: c });
    toast({ text: `Taux horaire : ${formatMoney(c)}/h (nouveaux quarts)`, tone: 'ok' });
  };

  const exportJson = async () => {
    const data = await exportBackup();
    await saveFile(`delivery-tracker-sauvegarde-${dateKey(new Date())}.json`, JSON.stringify(data, null, 2), 'application/json');
    toast({ text: 'Fichier de sauvegarde créé', tone: 'ok' });
  };

  const exportCsv = async () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = ['Journée;Heure;Mode;Pourboire ($)'];
    [...deliveries].sort((a, b) => a.time.localeCompare(b.time)).forEach((d) => lines.push([d.date, timeHM(d.time), d.method === 'cash' ? 'CASH' : 'MACHINE', (d.amount / 100).toFixed(2).replace('.', ',')].map(esc).join(';')));
    await saveFile(`livraisons-${dateKey(new Date())}.csv`, '﻿' + lines.join('\n'), 'text/csv');
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const replace = window.confirm('Remplacer TOUTES les données actuelles par cette sauvegarde ?\n\nOK = remplacer\nAnnuler = fusionner (sans doublons)');
      const r = await importBackup(data, replace ? 'replace' : 'merge');
      toast({ text: `Restauré : ${r.deliveries} livraisons, ${r.shifts} quarts, ${r.payouts} remises`, tone: 'ok' });
    } catch (e) {
      toast({ text: (e as Error).message || 'Fichier illisible', tone: 'error' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const themeBtn = (t: S['theme'], icon: React.ReactNode, label: string) => (
    <button onClick={() => setTheme(t)} className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${settings.theme === t ? 'bg-indigo-600 text-white' : 'muted'}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <h2 className="section-title">Rémunération</h2>
      <div className="card p-4">
        <label className="label" htmlFor="rate">Salaire horaire ($ CAD)</label>
        <div className="flex gap-2">
          <input id="rate" className="field" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          <button className="btn-primary" onClick={() => void saveRate()}>Enregistrer</button>
        </div>
        <p className="mt-2 text-xs muted">S'applique aux nouveaux quarts. Les quarts passés gardent leur taux (modifiable dans chaque quart). 100 % des pourboires vous reviennent.</p>
      </div>

      <h2 className="section-title">Apparence</h2>
      <div className="card flex gap-1 p-1">
        {themeBtn('dark', <Moon size={16} />, 'Sombre')}
        {themeBtn('light', <Sun size={16} />, 'Clair')}
        {themeBtn('system', <SunMoon size={16} />, 'Auto')}
      </div>

      <h2 className="section-title">Données et sauvegarde</h2>
      <div className="card space-y-3 p-4">
        <div className="flex items-start gap-3 text-sm">
          <Database size={18} className="mt-0.5 shrink-0 text-indigo-500" />
          <p>
            Données enregistrées automatiquement sur cet appareil (IndexedDB) : <b>{deliveries.length}</b> livraisons, <b>{shifts.length}</b> quarts, <b>{payouts.length}</b> remises.
            {persisted === true && <span className="text-emerald-500"> Stockage persistant activé.</span>}
          </p>
        </div>
        {persisted === false && (
          <button className="btn-ghost w-full" onClick={async () => setPersisted(await requestPersistence())}>
            Protéger le stockage contre l'effacement automatique
          </button>
        )}
        <button className="btn-primary w-full" onClick={() => void exportJson()}>
          <Download size={18} /> Créer un fichier de sauvegarde
        </button>
        <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
          <Upload size={18} /> Restaurer une sauvegarde
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImport(e.target.files?.[0])} />
        <button className="btn-ghost w-full" onClick={() => void exportCsv()}>
          <FileSpreadsheet size={18} /> Exporter les livraisons (CSV / Excel)
        </button>
        <p className="text-xs muted">Conseil : créez une sauvegarde chaque semaine et enregistrez-la dans iCloud Drive (Fichiers).</p>
      </div>

      <h2 className="section-title">Installer sur iPhone</h2>
      <div className="card p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold"><Smartphone size={18} className="text-indigo-500" /> Ajouter à l'écran d'accueil</div>
        <ol className="list-decimal space-y-1 pl-5 muted">
          <li>Ouvrez cette page dans <b>Safari</b>.</li>
          <li>Touchez le bouton <b>Partager</b> (carré avec flèche).</li>
          <li>Choisissez <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li>
          <li>Ouvrez ensuite toujours l'application depuis son icône.</li>
        </ol>
        <p className="mt-2 text-xs muted">Important : sur iPhone, les données de l'icône et celles de Safari sont séparées. Utilisez toujours l'icône (ou restaurez une sauvegarde).</p>
      </div>

      <h2 className="section-title">Zone sensible</h2>
      <button
        className="btn-danger w-full"
        onClick={async () => {
          if (!window.confirm('Effacer TOUTES les données ? Cette action est irréversible.')) return;
          if (!window.confirm('Dernière confirmation : avez-vous fait une sauvegarde ?')) return;
          await wipeAll();
          toast({ text: 'Toutes les données ont été effacées', tone: 'ok' });
        }}
      >
        <Trash2 size={18} /> Effacer toutes les données
      </button>
      <p className="pb-4 pt-2 text-center text-xs muted">Delivery Tracker Pro · v1.0 · 100 % local, gratuit, hors ligne</p>
    </div>
  );
}
