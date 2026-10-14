// Capture d'écran d'une page NodeCG (graphic ou panneau) avec un navigateur invisible (Chrome, Edge ou Firefox).
// Usage : node tools/shot.js <url> <sortie.png> [--wait 2500] [--w 1920] [--h 1080] [--eval "js à exécuter avant d'attendre"]
// Ex.   : node tools/shot.js http://localhost:9090/bundles/valorant-tournament/graphics/versus.html shots/versus.png --wait 2000
//         (panneau hors tableau de bord : ajouter ?standalone=true à l'URL)
const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('./browser');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const [url, out] = args;
if (!url || !out) { console.error('Usage: node tools/shot.js <url> <out.png> [--wait ms] [--w px] [--h px] [--eval js]'); process.exit(1); }
(async () => {
	const { browser } = await launchBrowser();
	try {
		const page = await browser.newPage({ viewport: { width: +opt('w', 1920), height: +opt('h', 1080) } });
		const logs = [];
		page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
		page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
		await page.goto(url, { waitUntil: 'load' });
		const js = opt('eval');
		if (js) await page.evaluate(js);
		await page.waitForTimeout(+opt('wait', 2500));
		fs.mkdirSync(path.dirname(out), { recursive: true });
		await page.screenshot({ path: out, omitBackground: false });
		console.log('OK ' + out);
		if (logs.length) console.log(logs.join('\n'));
	} finally {
		await browser.close();
	}
})().catch((e) => { console.error(e); process.exit(1); });
