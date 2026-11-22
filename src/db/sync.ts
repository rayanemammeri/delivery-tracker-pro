/**
 * Point d'extension pour une future synchronisation cloud (Supabase, Firebase, serveur perso…).
 * Chaque écriture de repo.ts appelle notifyChange(). Un adaptateur pourra :
 *  - pousser les enregistrements modifiés (identifiés par UUID + updatedAt),
 *  - récupérer les changements distants et les fusionner via importBackup(…, 'merge').
 * Aucun service n'est branché par défaut : l'application est 100 % locale et gratuite.
 */
export type TableName = 'shifts' | 'deliveries' | 'payouts' | 'all';

export interface SyncAdapter {
  onLocalChange(table: TableName, id: string): void;
}

let adapter: SyncAdapter | null = null;

export function registerSyncAdapter(a: SyncAdapter | null): void {
  adapter = a;
}

export function notifyChange(table: TableName, id: string): void {
  adapter?.onLocalChange(table, id);
}
