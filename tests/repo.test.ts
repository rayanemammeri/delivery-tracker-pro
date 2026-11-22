import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, TrackerDB } from '../src/db/db';
import * as repo from '../src/db/repo';
import { computeLedger, summarizeDay } from '../src/lib/calc';

beforeEach(async () => {
  await repo.wipeAll();
  await db.kv.clear();
});

describe('Base de données (IndexedDB)', () => {
  it('commence / termine le travail et calcule le salaire', async () => {
    const start = new Date(2026, 10, 21, 16, 0);
    const s = await repo.startShift(start);
    expect(s.date).toBe('2026-11-21');
    expect(s.hourlyRate).toBe(1200);
    // un second « commencer » ne crée pas de doublon
    const again = await repo.startShift(new Date(2026, 10, 21, 16, 5));
    expect(again.id).toBe(s.id);
    expect(await db.shifts.count()).toBe(1);
    await repo.endShift(new Date(2026, 10, 21, 22, 0));
    const day = summarizeDay('2026-11-21', await db.shifts.toArray(), []);
    expect(day.salary).toBe(7200);
  });

  it('rattache les livraisons après minuit au quart en cours', async () => {
    await repo.startShift(new Date(2026, 10, 21, 18, 0));
    const d = await repo.addDelivery(550, 'cash', new Date(2026, 10, 22, 0, 45));
    expect(d.date).toBe('2026-11-21');
    await repo.endShift(new Date(2026, 10, 22, 2, 0));
    const day = summarizeDay('2026-11-21', await db.shifts.toArray(), await db.deliveries.toArray());
    expect(day.salary).toBe(9600);
    expect(day.cash).toBe(550);
  });

  it('pause : temps non rémunéré', async () => {
    await repo.startShift(new Date(2026, 10, 21, 16, 0));
    await repo.toggleBreak(new Date(2026, 10, 21, 19, 0));
    await repo.toggleBreak(new Date(2026, 10, 21, 19, 30));
    await repo.endShift(new Date(2026, 10, 21, 22, 0));
    expect(summarizeDay('2026-11-21', await db.shifts.toArray(), []).salary).toBe(6600);
  });

  it('ajoute, modifie et supprime des livraisons ; totaux à jour', async () => {
    const at = new Date(2026, 10, 21, 18, 0);
    const a = await repo.addDelivery(550, 'cash', at);
    const b = await repo.addDelivery(400, 'machine', at);
    await repo.addDelivery(725, 'cash', at);
    await repo.addDelivery(350, 'machine', at);
    let day = summarizeDay('2026-11-21', [], await db.deliveries.toArray());
    expect([day.cash, day.machine, day.total, day.count]).toEqual([1275, 750, 2025, 4]);

    await repo.updateDelivery(b.id, { amount: 500, method: 'cash' });
    day = summarizeDay('2026-11-21', [], await db.deliveries.toArray());
    expect([day.cash, day.machine, day.total]).toEqual([1775, 350, 2125]);

    await repo.deleteDelivery(a.id);
    day = summarizeDay('2026-11-21', [], await db.deliveries.toArray());
    expect([day.cash, day.count, day.total]).toEqual([1225, 3, 1575]);
    await expect(repo.addDelivery(-5, 'cash')).rejects.toThrow();
    await expect(repo.addDelivery(5.5, 'cash')).rejects.toThrow();
  });

  it('mémorise le dernier mode de paiement utilisé', async () => {
    await repo.addDelivery(400, 'machine', new Date(2026, 10, 21, 18));
    expect((await repo.getSettings()).defaultMethod).toBe('machine');
  });

  it('remises du patron : ajout, modification, suppression', async () => {
    await repo.addDelivery(9500, 'machine', new Date(2026, 10, 21, 18));
    await repo.addDelivery(5500, 'cash', new Date(2026, 10, 21, 18));
    const p = await repo.addPayout({ amount: 4000, date: '2026-11-21', forDate: null, note: '' });
    await repo.addPayout({ amount: 2000, date: '2026-11-22', forDate: null, note: 'reste' });
    let l = computeLedger(await db.deliveries.toArray(), await db.payouts.toArray());
    expect([l.totalAccrued, l.totalPaid, l.totalDue]).toEqual([9500, 6000, 3500]);
    await repo.updatePayout(p.id, { amount: 3000 });
    await repo.deletePayout((await db.payouts.toArray()).find((x) => x.note === 'reste')!.id);
    l = computeLedger(await db.deliveries.toArray(), await db.payouts.toArray());
    expect(l.totalDue).toBe(6500);
    await expect(repo.addPayout({ amount: 0, date: '2026-11-21', forDate: null, note: '' })).rejects.toThrow();
  });

  it('corrige un quart oublié (saisie manuelle) et refuse les incohérences', async () => {
    await repo.saveShift({ id: 'manual', date: '2026-11-20', start: new Date(2026, 10, 20, 16).toISOString(), end: new Date(2026, 10, 20, 21).toISOString(), breaks: [], breakMinutes: 0, hourlyRate: 1200 });
    expect(summarizeDay('2026-11-20', await db.shifts.toArray(), []).salary).toBe(6000);
    await expect(repo.saveShift({ id: 'bad', date: '2026-11-20', start: new Date(2026, 10, 20, 16).toISOString(), end: new Date(2026, 10, 20, 15).toISOString(), breaks: [], breakMinutes: 0, hourlyRate: 1200 })).rejects.toThrow();
  });

  it('les données survivent à la fermeture et réouverture de la base', async () => {
    await repo.addDelivery(550, 'cash', new Date(2026, 10, 21, 18));
    await repo.addPayout({ amount: 100, date: '2026-11-21', forDate: null, note: '' });
    db.close();
    const reopened = new TrackerDB();
    expect(await reopened.deliveries.count()).toBe(1);
    expect(await reopened.payouts.count()).toBe(1);
    reopened.close();
    await db.open();
  });

  it('sauvegarde / restauration sans doublons', async () => {
    await repo.addDelivery(550, 'cash', new Date(2026, 10, 21, 18));
    await repo.startShift(new Date(2026, 10, 21, 16));
    const backup = JSON.parse(JSON.stringify(await repo.exportBackup()));
    await repo.importBackup(backup, 'merge'); // fusion avec soi-même
    expect(await db.deliveries.count()).toBe(1);
    expect(await db.shifts.count()).toBe(1);
    await repo.wipeAll();
    expect(await db.deliveries.count()).toBe(0);
    await repo.importBackup(backup, 'replace');
    expect(await db.deliveries.count()).toBe(1);
    await expect(repo.importBackup({ foo: 1 }, 'merge')).rejects.toThrow('invalide');
  });
});
