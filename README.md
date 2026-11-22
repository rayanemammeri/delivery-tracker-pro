# Delivery Tracker Pro

Application personnelle (PWA) pour livreur : heures de travail, livraisons, pourboires **CASH** / **MACHINE**,
remises du patron, bilan quotidien, historique et statistiques. 100 % locale, gratuite, fonctionne hors ligne.

## Lancer l'application sur l'ordinateur

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install
npm run dev
```

Ouvrir l'adresse affichée (ex. `http://localhost:5173`). L'adresse « Network » permet de l'ouvrir depuis
l'iPhone sur le même Wi-Fi (pour essayer seulement : l'installation PWA demande HTTPS, voir plus bas).

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests des calculs et de la base de données (33 tests) |
| `npm run build` | Version de production dans `dist/` |
| `npm run test:e2e` | Test complet sur iPhone émulé (après `npm run build`, nécessite Playwright) |

## Publier gratuitement (pour l'iPhone)

**Option A — Netlify Drop (le plus simple, 2 minutes)**
1. `npm run build`
2. Aller sur https://app.netlify.com/drop et glisser le dossier `dist`.
3. Créer un compte gratuit pour garder le site ; on obtient une adresse `https://…netlify.app`.

**Option B — GitHub Pages (mise à jour automatique)**
1. Créer un dépôt GitHub et y pousser ce dossier (branche `main`).
2. Dans le dépôt : *Settings → Pages → Source : GitHub Actions*.
3. Chaque push lance les tests puis publie sur `https://<utilisateur>.github.io/<depot>/`.

**Option C — Vercel / Cloudflare Pages** : importer le dépôt, commande `npm run build`, dossier `dist`.

## Installer sur l'iPhone

1. Ouvrir l'adresse publiée dans **Safari**.
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Toujours ouvrir l'application depuis l'icône : sur iOS, les données de l'icône et celles de Safari sont séparées.
4. Faire une sauvegarde régulièrement : *Réglages (⚙) → Créer un fichier de sauvegarde* → Enregistrer dans Fichiers / iCloud.

## Règles de calcul

- Montants stockés en **cents** (entiers) : aucune erreur d'arrondi.
- Salaire = temps travaillé (moins les pauses non payées) × taux horaire (12 $ par défaut), arrondi au cent.
- Un quart appartient à la journée de son début, même s'il finit après minuit. Une heure de fin inférieure au début = lendemain.
- La journée change à 5 h du matin : une livraison à 1 h 30 compte pour la veille.
- Pourboires MACHINE : jamais considérés comme remis automatiquement. Une remise du patron couvre d'abord la
  journée choisie (si précisée), sinon les montants dus les plus anciens. Les pourboires CASH ne sont jamais dus par le patron.

## Architecture

```
src/
  lib/      calculs purs (calc.ts), montants, dates, rapport, PDF, thème, routeur
  db/       IndexedDB (Dexie) : db.ts, repo.ts (toutes les écritures), sync.ts (point d'extension cloud)
  hooks/    DataProvider : données en direct, tous les totaux se recalculent automatiquement
  components/ et pages/  interface (React + Tailwind)
tests/      tests unitaires (Vitest + fake-indexeddb)
e2e/        test de bout en bout sur iPhone émulé (Playwright)
```

Synchronisation cloud future : chaque enregistrement a un identifiant UUID et une date `updatedAt`, et toutes
les écritures passent par `repo.ts`, qui appelle `notifyChange()` dans `sync.ts`. Il suffira d'y brancher un adaptateur
(Supabase, Firebase…) ; la fusion sans doublons existe déjà (`importBackup(…, 'merge')`).
