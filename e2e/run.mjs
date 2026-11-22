// Test de bout en bout sur iPhone émulé (Playwright). Usage : npm run build && npm run test:e2e
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium, devices } = pw;

const OUT = process.env.SHOTS ?? 'e2e/screenshots';
mkdirSync(OUT, { recursive: true });
const PORT = 4300 + Math.floor(Math.random() * 600);
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
await new Promise((r, j) => {
  server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && r());
  server.stderr.on('data', (d) => j(new Error(d.toString())));
  setTimeout(() => j(new Error('Le serveur de prévisualisation ne démarre pas (avez-vous lancé npm run build ?)')), 20000);
});
const URL = `http://localhost:${PORT}/`;

const assert = (cond, msg) => { if (!cond) throw new Error('ÉCHEC : ' + msg); console.log('  ✓ ' + msg); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-CA', timezoneId: 'America/Toronto' });
ctx.setDefaultTimeout(8000);
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto(URL);
  await page.getByTestId('start-shift').click();
  await page.getByTestId('shift-clock').waitFor();
  assert(true, 'Commencer le travail démarre le chronomètre');

  const type = async (digits) => { for (const d of digits) await page.getByRole('button', { name: d, exact: true }).click(); };
  const add = async (digits, method) => {
    await type(digits);
    await page.getByRole('radio', { name: method }).click();
    await page.getByTestId('add-delivery').click();
    await page.waitForTimeout(400);
  };
  await add('550', 'CASH');
  await add('400', 'MACHINE');
  await add('725', 'CASH');
  await add('350', 'MACHINE');
  assert((await page.getByTestId('tip-cash').textContent()) === '12,75 $', 'Pourboires CASH = 12,75 $');
  assert((await page.getByTestId('tip-machine').textContent()) === '7,50 $', 'Pourboires MACHINE = 7,50 $');
  assert((await page.getByTestId('tip-total').textContent()) === '20,25 $', 'Total des pourboires = 20,25 $');
  assert((await page.getByTestId('delivery-list').locator('li').count()) === 4, '4 livraisons dans la liste');

  // Double-tap rapide → une seule livraison
  await type('100');
  await page.getByTestId('add-delivery').dblclick();
  await page.waitForTimeout(500);
  assert((await page.getByTestId('delivery-list').locator('li').count()) === 5, 'Un double-tap ne crée pas de doublon');

  // Modification : la dernière (1,00 $) → 2,00 $ MACHINE
  await page.getByTestId('delivery-list').locator('li').first().click();
  await page.locator('#d-amount').fill('2,00');
  await page.getByRole('dialog').getByRole('radio', { name: 'MACHINE' }).click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(300);
  assert((await page.getByTestId('tip-machine').textContent()) === '9,50 $', 'Modification : machine passe à 9,50 $');

  // Suppression
  await page.getByTestId('delivery-list').locator('li').first().click();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await page.waitForTimeout(300);
  assert((await page.getByTestId('tip-total').textContent()) === '20,25 $', 'Suppression : total revient à 20,25 $');
  await page.screenshot({ path: `${OUT}/1-aujourdhui.png` });
  await page.screenshot({ path: `${OUT}/1b-aujourdhui-complet.png`, fullPage: true });

  // Patron : remise partielle de 5 $
  await page.getByRole('button', { name: 'Patron', exact: true }).click();
  assert((await page.getByTestId('boss-due').textContent()) === '7,50 $', 'Reste à recevoir initial = 7,50 $ (aucune remise automatique)');
  await page.getByTestId('add-payout').click();
  await page.locator('#p-amount').fill('5');
  await page.getByTestId('save-payout').click();
  await page.waitForTimeout(300);
  assert((await page.getByTestId('boss-due').textContent()) === '2,50 $', 'Après remise de 5 $ : reste 2,50 $');
  await page.screenshot({ path: `${OUT}/2-patron.png`, fullPage: true });

  // Persistance : rechargement complet
  await page.goto(URL + '#/');
  await page.reload();
  await page.getByTestId('tip-total').waitFor();
  assert((await page.getByTestId('tip-total').textContent()) === '20,25 $', 'Données conservées après rechargement');
  await page.getByTestId('shift-clock').waitFor();
  assert(true, 'Quart toujours en cours après rechargement');

  // Fermeture complète de l'onglet puis réouverture
  await page.close();
  const page2 = await ctx.newPage();
  page2.on('dialog', (d) => d.accept());
  await page2.goto(URL + '#/patron');
  assert((await page2.getByTestId('boss-due').textContent()) === '2,50 $', 'Remises conservées après fermeture de l’onglet');

  // Terminer le travail puis bilan
  await page2.goto(URL);
  await page2.getByTestId('end-shift').click();
  await page2.getByTestId('start-shift').waitFor();
  assert(true, 'Terminer le travail');
  await page2.getByRole('button', { name: 'Bilan', exact: true }).click();
  const report = await page2.getByTestId('report').textContent();
  assert(report.includes('Pourboires machine déjà remis5,00 $') && report.includes('Reste à recevoir (cette journée)2,50 $'), 'Bilan : remis / reste corrects');
  assert(report.includes('Total des pourboires20,25 $'), 'Bilan : total des pourboires');
  await page2.screenshot({ path: `${OUT}/3-bilan.png`, fullPage: true });
  const dl = page2.waitForEvent('download');
  await page2.getByRole('button', { name: 'Exporter en PDF' }).click();
  const file = await dl;
  await file.saveAs(`${OUT}/bilan.pdf`);
  assert(file.suggestedFilename().startsWith('bilan-') && file.suggestedFilename().endsWith('.pdf'), 'Export PDF généré');

  await page2.getByRole('button', { name: 'Historique', exact: true }).click();
  await page2.getByTestId('history').waitFor();
  assert((await page2.getByTestId('history').locator('button').count()) >= 1, 'Historique affiché');
  await page2.screenshot({ path: `${OUT}/4-historique.png`, fullPage: true });
  await page2.getByRole('button', { name: 'Stats', exact: true }).click();
  await page2.getByTestId('stats').waitFor();
  await page2.waitForTimeout(600);
  assert((await page2.locator('.recharts-surface').count()) >= 2, 'Graphiques affichés');
  await page2.screenshot({ path: `${OUT}/5-stats.png`, fullPage: true });

  for (const route of ['', 'patron', 'bilan', 'historique', 'stats', 'reglages']) {
    await page2.goto(URL + '#/' + route);
    await page2.waitForTimeout(300);
    const overflow = await page2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `Pas de débordement horizontal sur iPhone (#/${route})`);
  }
  await page2.evaluate(() => { localStorage.setItem('dtp-theme', 'light'); });
  await page2.goto(URL + '#/reglages');
  await page2.getByRole('button', { name: 'Clair' }).click();
  await page2.waitForTimeout(400);
  await page2.goto(URL);
  await page2.waitForTimeout(300);
  await page2.screenshot({ path: `${OUT}/6-theme-clair.png` });
  assert(!(await page2.evaluate(() => document.documentElement.classList.contains('dark'))), 'Thème clair conservé après rechargement');
  assert(errors.length === 0, 'Aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));
  console.log('\nTous les tests de bout en bout ont réussi.');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch {}
}
