// Vérification rapide : ouvre chaque overlay et chaque panneau dans un navigateur invisible (Chrome, Edge ou Firefox) et signale
// les erreurs (console, exceptions, fichiers introuvables). Le serveur NodeCG doit tourner.
// Usage : npm run check            (ou : node tools/check.js [--base http://localhost:9090] [--shots dossier] [--only graphics|dashboard] [--wait 1500])
//   --shots <dossier> : enregistre aussi une capture PNG de chaque page
// Code de sortie : 0 si tout est propre, 1 sinon.
const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('./browser');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const pkg = require('../package.json');
const base = String(opt('base', `http://localhost:${process.env.PORT || 9090}`)).replace(/\/$/, '');
const shots = opt('shots');
const only = opt('only');
const wait = +opt('wait', 1500);

const pages = [];
if (only !== 'dashboard') for (const g of pkg.nodecg.graphics) pages.push({ kind: 'graphics', file: g.file, w: g.width, h: g.height });
if (only !== 'graphics') for (const p of pkg.nodecg.dashboardPanels) pages.push({ kind: 'dashboard', file: p.file, w: 160 * p.width, h: 900 });

(async () => {
	try { await fetch(base); } catch { console.error(`Serveur injoignable sur ${base} — lance d'abord start.bat (ou npm start).`); process.exit(1); }
	const { browser } = await launchBrowser();
	let bad = 0;
	for (const p of pages) {
		// Un panneau ouvert hors du tableau de bord a besoin de ?standalone=true pour recevoir l'API NodeCG
		const url = `${base}/bundles/${pkg.name}/${p.kind}/${p.file}${p.kind === 'dashboard' ? '?standalone=true' : ''}`;
		const page = await browser.newPage({ viewport: { width: p.w, height: p.h } });
		const errors = [];
		page.on('console', (m) => { if (m.type() === 'error') errors.push('console : ' + m.text()); });
		page.on('pageerror', (e) => errors.push('exception : ' + e.message));
		page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base)) errors.push(`HTTP ${r.status()} : ${r.url().slice(base.length)}`); });
		try {
			await page.goto(url, { waitUntil: 'load', timeout: 20000 });
			await page.waitForTimeout(wait);
			if (shots) {
				fs.mkdirSync(path.join(shots, p.kind), { recursive: true });
				await page.screenshot({ path: path.join(shots, p.kind, p.file.replace(/\.html$/, '.png')) });
			}
		} catch (e) { errors.push('chargement : ' + e.message.split('\n')[0]); }
		await page.close();
		const unique = [...new Set(errors)];
		console.log(`${unique.length ? '✖' : '✔'} ${p.kind}/${p.file}`);
		for (const e of unique) console.log('    ' + e);
		if (unique.length) bad++;
	}
	await browser.close();
	console.log(bad ? `\n${bad} page(s) en erreur sur ${pages.length}.` : `\n${pages.length} pages vérifiées, aucune erreur.`);
	process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
