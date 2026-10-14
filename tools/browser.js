// Trouve et lance un navigateur installé pour les outils (export du stinger, captures, vérification).
// Ordre : Chrome, puis Edge, puis Firefox (Chrome et Edge sont plus rapides et gèrent la transparence nativement).
// Pour forcer : variables d'environnement CHROME_PATH (Chrome / Edge / Chromium), FIREFOX_PATH (Firefox),
// ou KB_BROWSER=firefox pour préférer Firefox même si Chrome est installé.
// Firefox est piloté tel quel (protocole WebDriver BiDi de Playwright, canal « moz-firefox ») : aucun téléchargement.
const fs = require('fs');
const os = require('os');
const path = require('path');

const winDirs = () => [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);

const CANDIDATES = {
	chromium: () => [
		process.env.CHROME_PATH,
		...winDirs().flatMap((dir) => [path.join(dir, 'Google/Chrome/Application/chrome.exe'), path.join(dir, 'Microsoft/Edge/Application/msedge.exe')]),
		'/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
	],
	firefox: () => [
		process.env.FIREFOX_PATH,
		...winDirs().map((dir) => path.join(dir, 'Mozilla Firefox/firefox.exe')),
		// Linux : /usr/bin/firefox n'est souvent qu'un script qui renvoie vers le snap, on vise le vrai lanceur d'abord
		'/snap/bin/firefox', '/usr/lib/firefox/firefox', '/usr/lib64/firefox/firefox', '/usr/bin/firefox',
		'/Applications/Firefox.app/Contents/MacOS/firefox',
	],
};

/** { engine: 'chromium' | 'firefox', path } du premier navigateur trouvé */
function findBrowser() {
	const order = /^firefox$/i.test(process.env.KB_BROWSER || '') ? ['firefox', 'chromium'] : ['chromium', 'firefox'];
	for (const engine of order) {
		const found = CANDIDATES[engine]().filter(Boolean).find((p) => fs.existsSync(p));
		if (found) return { engine, path: found };
	}
	throw new Error('Aucun navigateur trouvé (Chrome, Edge ou Firefox). Installe-en un, ou indique son chemin dans CHROME_PATH ou FIREFOX_PATH.');
}

/** Lance le navigateur trouvé en mode invisible. { browser, engine, path } */
async function launchBrowser() {
	const { chromium, firefox } = require('playwright-core');
	const { engine, path: exe } = findBrowser();
	if (engine === 'chromium') return { browser: await chromium.launch({ executablePath: exe, headless: true }), engine, path: exe };
	// Firefox en snap (Ubuntu) ne voit pas le /tmp du système : le profil temporaire doit être dans son dossier à lui
	if (exe.startsWith('/snap/')) {
		const tmp = path.join(os.homedir(), 'snap', 'firefox', 'common', 'tmp');
		fs.mkdirSync(tmp, { recursive: true });
		process.env.TMPDIR = tmp;
	}
	return { browser: await firefox.launch({ channel: 'moz-firefox', executablePath: exe, headless: true, timeout: 60000 }), engine, path: exe };
}

const nextPaint = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const setBackground = (page, color) => page.evaluate((c) => {
	let el = document.getElementById('kb-capture-bg');
	if (!el) { el = document.createElement('style'); el.id = 'kb-capture-bg'; document.head.appendChild(el); }
	el.textContent = c ? `html, body { background: ${c} !important; }` : '';
}, color);

/**
 * Capture PNG avec canal alpha (fond de page transparent) — Buffer.
 * Chrome / Edge : capture native sans fond. Firefox ne sait pas capturer sans fond (BiDi) : la page est capturée
 * sur fond noir puis sur fond blanc, et l'opacité de chaque pixel se déduit de l'écart entre les deux (alpha = 1 − (blanc − noir)).
 * Nécessite sharp.
 */
async function captureTransparent(page, engine) {
	const sharp = require('sharp');
	if (engine === 'chromium') {
		// Chrome enregistre les images 100 % opaques en RGB : on force RGBA pour une séquence homogène
		return sharp(await page.screenshot({ omitBackground: true })).ensureAlpha().png({ compressionLevel: 6 }).toBuffer();
	}
	await setBackground(page, '#000'); await nextPaint(page);
	const onBlack = await page.screenshot();
	await setBackground(page, '#fff'); await nextPaint(page);
	const onWhite = await page.screenshot();
	await setBackground(page, null);
	const [b, w] = await Promise.all([onBlack, onWhite].map((buf) => sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
	const { width, height } = b.info, B = b.data, W = w.data, out = Buffer.alloc(width * height * 4);
	for (let i = 0; i < out.length; i += 4) {
		const a = 255 - ((W[i] - B[i]) + (W[i + 1] - B[i + 1]) + (W[i + 2] - B[i + 2])) / 3;
		if (a <= 0.5) continue; // pixel transparent : reste 0,0,0,0
		const k = 255 / Math.min(255, a);
		out[i] = Math.min(255, Math.round(B[i] * k));
		out[i + 1] = Math.min(255, Math.round(B[i + 1] * k));
		out[i + 2] = Math.min(255, Math.round(B[i + 2] * k));
		out[i + 3] = Math.min(255, Math.round(a));
	}
	return sharp(out, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 6 }).toBuffer();
}

module.exports = { findBrowser, launchBrowser, captureTransparent };
