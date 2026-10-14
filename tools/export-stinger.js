// Export du stinger (graphics/transition.html) en séquence PNG transparente, image par image.
// Usage : node tools/export-stinger.js [--map Ascent | --replay] [--fps 60] [--out exports/stinger-ascent] [--host http://localhost:9090]
//         [--settings '{"coverIn":600,"holdLogo":360,"holdMap":2500,"revealOut":540}']  (défaut : replicant mapsTransitionSettings)
// Sortie : <out>/frame_0001.png … + info.txt. Le serveur NodeCG doit tourner.
// Navigateur : Chrome, Edge ou Firefox (tools/browser.js) ; avec Firefox chaque image est capturée deux fois (plus lent).
// Progression sur stdout : "PROGRESS i/n", puis "DONE <dossier>" (ou "ERROR <message>" + code 1).
const path = require('path');
const fs = require('fs');
const { launchBrowser, captureTransparent } = require('./browser');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] != null ? args[i + 1] : def; };
const replay = args.includes('--replay');
const map = replay ? null : opt('map', '') || null;
const kind = replay ? 'replay' : map ? 'map' : 'logo';
const settings = opt('settings', '') ? JSON.parse(opt('settings')) : null;
const fps = Math.max(1, +opt('fps', 60));
const host = opt('host', 'http://localhost:9090');
const root = path.resolve(__dirname, '..');
const slug = replay ? '-replay' : map ? '-' + map.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
const out = path.resolve(root, opt('out', `exports/stinger${slug}`));

(async () => {
	const { browser, engine } = await launchBrowser();
	try {
		const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
		const errors = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(`${host}/bundles/valorant-tournament/graphics/transition.html?export=1`, { waitUntil: 'load' });
		await page.waitForFunction(() => window.stingerExport, null, { timeout: 15000 });
		const info = await page.evaluate(([m, st, k]) => window.stingerExport.prepare(m, st, k), [map, settings, kind]);

		fs.rmSync(out, { recursive: true, force: true });
		fs.mkdirSync(out, { recursive: true });
		const total = Math.round(info.duration * fps / 1000) + 1; // inclut t=0 et t=durée (transparentes)
		for (let i = 0; i < total; i++) {
			const t = (i * 1000) / fps;
			await page.evaluate((ms) => window.stingerExport.seek(ms), t);
			await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
			const file = path.join(out, `frame_${String(i + 1).padStart(4, '0')}.png`);
			fs.writeFileSync(file, await captureTransparent(page, engine));
			console.log(`PROGRESS ${i + 1}/${total}`);
		}
		const frameOf = (ms) => Math.round(ms * fps / 1000) + 1;
		fs.writeFileSync(path.join(out, 'info.txt'), [
			'KB SERIES — stinger (graphics/transition.html)',
			replay ? 'Type : replay (titre « REPLAY »)' : `Map : ${map || 'aucune (logo seul)'}`,
			'Format : PNG 1920x1080, fond transparent (alpha)',
			`Navigateur : ${engine === 'firefox' ? 'Firefox' : 'Chrome / Edge'}`,
			`Cadence : ${fps} images/s`,
			`Nombre d'images : ${total} (frame_0001 → frame_${String(total).padStart(4, '0')})`,
			`Durée : ${info.duration} ms`,
			`Réglages : entrée ${info.coverIn} ms · tenue ${Math.round(info.hold / info.speed)} ms (${{ logo: 'holdLogo', map: 'holdMap', replay: 'holdReplay' }[kind]}) · sortie ${info.revealOut} ms (vitesse ×${info.speed} incluse)`,
			info.s ? `Style : direction ${info.s.direction} · angle ${info.s.angle}° · easing ${info.s.easing} · ${info.s.panels} volets · décalage ${info.s.stagger} ms · palette ${info.s.palette} · logo ${info.s.logoAnim}` : '',
			`Écran totalement couvert : ${info.coveredFrom} → ${info.coveredTo} ms (images ${frameOf(info.coveredFrom)} → ${frameOf(info.coveredTo)}, soit ${info.coveredMs} ms)`,
			`Point de coupe conseillé : ${info.cut} ms (image ${frameOf(info.cut)})`,
			'',
			'OBS : convertir en vidéo avec alpha puis transition « Stinger » (point de transition en temps : ' + info.cut + ' ms).',
			`  ex. ffmpeg -framerate ${fps} -i frame_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le stinger.mov`,
			`  ou  ffmpeg -framerate ${fps} -i frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 20 stinger.webm`,
			'',
		].join('\r\n'));
		if (errors.length) console.log('WARN ' + errors.join(' | '));
		console.log('DONE ' + out);
	} finally {
		await browser.close();
	}
})().catch((e) => { console.log('ERROR ' + (e && e.message || e)); process.exit(1); });
