import Dexie, { type EntityTable } from 'dexie';
import type { Delivery, Payout, Shift } from '../lib/types';

export interface KV {
  key: string;
  value: unknown;
}

/**
 * Base locale IndexedDB (via Dexie). Les données restent sur l'appareil,
 * persistent après fermeture et fonctionnent hors ligne.
 */
export class TrackerDB extends Dexie {
  shifts!: EntityTable<Shift, 'id'>;
  deliveries!: EntityTable<Delivery, 'id'>;
  payouts!: EntityTable<Payout, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'delivery-tracker-pro') {
    super(name);
    this.version(1).stores({
      shifts: 'id, date, start, end, updatedAt',
      deliveries: 'id, date, time, method, updatedAt',
      payouts: 'id, date, forDate, updatedAt',
      kv: 'key',
    });
  }
}

export const db = new TrackerDB();
