// Logique serveur : maps (replicants propres à cette partie)
// - mapsGraphics : visibilité / options des graphics map-intro, map-series, map-result (défaut : KBM.DEFAULT, shared/maps.js)
//     intro.index / result.index : index dans match.maps (null = match.currentMap)
//     result.mvp : riotId du MVP ou nom saisi librement (ou null) ; result.mvpTeam : 'A'|'B'|null (équipe du MVP en saisie libre, défaut = vainqueur)
// - mapsTransitionSettings : réglages du stinger (durées, volets, logo, map, préréglages perso) — KBM.TRANSITION_DEFAULT
// - mapsExport : état de l'export PNG du stinger { running, done, total, map, kind, path, error, at }
// Message 'maps:exportStinger' { map, kind } → { started: true } (kind : 'logo' | 'map' | 'replay') : lance tools/export-stinger.js (séquence PNG transparente
// 60 i/s dans exports/). Le stinger (graphics/transition.html) écoute le replicant coeur `transition` ({ at, map, kind }).
// Téléchargement des exports (réservé aux personnes connectées si le mot de passe est activé) :
//   GET /valorant-tournament/stinger-exports                   → { ok, exports: [{ name, frames, bytes, at }] } (plus récent d'abord)
//   GET /valorant-tournament/stinger-exports/<dossier>.zip     → archive ZIP du dossier (images + info.txt)
const fs = require('fs');
const path = require('path');
const express = require('express');
const { spawn } = require('child_process');
const KBM = require('../shared/maps.js');
const { ROOT } = require('./lib/paths');
const { requireLogin } = require('./lib/http');
const { sendZip } = require('./lib/zip');

const clone = (v) => JSON.parse(JSON.stringify(v));
// Un export peut durer plusieurs minutes (1,5 à 2 images/s, moins si OBS charge la machine) : on ne l'arrête
// que s'il n'avance plus du tout pendant ce délai.
const STALLED_MS = 90 * 1000;
const EXPORTS = path.join(ROOT, 'exports');
// Dossiers écrits par tools/export-stinger.js : stinger, stinger-<map>, stinger-replay
const EXPORT_NAME = /^stinger(-[a-z0-9-]+)?$/;

// Contenu d'un dossier d'export : images PNG et info.txt (rien d'autre n'est envoyé)
async function exportFiles(name) {
	const dir = path.join(EXPORTS, name);
	const files = (await fs.promises.readdir(dir)).filter((f) => /^frame_\d+\.png$/.test(f) || f === 'info.txt').sort();
	const stats = await Promise.all(files.map((f) => fs.promises.stat(path.join(dir, f))));
	return files.map((f, i) => ({ name: f, file: path.join(dir, f), size: stats[i].size, at: stats[i].mtimeMs }));
}

module.exports = function (nodecg, listen) {
	nodecg.Replicant('mapsGraphics', { defaultValue: clone(KBM.DEFAULT) });
	// Rétro-compatible : un ancien objet { coverIn, holdLogo, holdMap, revealOut } est complété par les défauts côté client.
	nodecg.Replicant('mapsTransitionSettings', { defaultValue: clone(KBM.TRANSITION_DEFAULT) });
	const exp = nodecg.Replicant('mapsExport', { defaultValue: { running: false, done: 0, total: 0, map: null, kind: 'logo', path: null, error: null, at: 0 } });
	// Un export ne survit pas à un redémarrage du serveur
	if (exp.value && exp.value.running) exp.value = { ...exp.value, running: false, error: 'Export interrompu (redémarrage du serveur)' };

	let child = null;
	// Dossier en cours d'écriture (vidé au lancement par l'export) : pas téléchargeable avant la fin
	let writing = null;
	// Le navigateur headless lancé par l'export ne doit pas survivre au serveur
	process.once('exit', () => { if (child) child.kill(); });

	listen('maps:exportStinger', (data) => {
		if (child) throw new Error('Un export est déjà en cours');
		// L'image Docker est installée sans les outils de développement (playwright-core) : export impossible en ligne
		try { require.resolve('playwright-core', { paths: [ROOT] }); } catch {
			throw new Error('Export indisponible sur ce serveur : fais-le depuis la régie locale');
		}
		const kind = KBM.trKind(data.kind === 'replay' ? 'replay' : !!data.map);
		const map = kind === 'map' ? String(data.map).replace(/[^\w '-]/g, '').slice(0, 40) : null;
		const port = (nodecg.config && nodecg.config.port) || 9090;
		const args = [path.join(ROOT, 'tools', 'export-stinger.js'), '--host', `http://localhost:${port}`];
		if (map) args.push('--map', map);
		if (kind === 'replay') args.push('--replay');
		exp.value = { running: true, done: 0, total: 0, map, kind, path: null, error: null, at: Date.now() };
		const proc = spawn(process.execPath, args, { cwd: ROOT, windowsHide: true });
		// Même nom de dossier que tools/export-stinger.js
		writing = kind === 'replay' ? 'stinger-replay' : map ? 'stinger-' + map.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'stinger';
		child = proc;
		let timeout = null;
		const watchdog = () => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				exp.value = { ...exp.value, error: `Export arrêté : plus aucune image depuis ${STALLED_MS / 1000} secondes` };
				proc.kill();
			}, STALLED_MS);
		};
		watchdog();
		let buf = '';
		const onLine = (line) => {
			let m;
			if ((m = line.match(/^PROGRESS (\d+)\/(\d+)/))) { watchdog(); exp.value = { ...exp.value, done: +m[1], total: +m[2] }; }
			else if ((m = line.match(/^DONE (.+)$/))) exp.value = { ...exp.value, path: m[1].trim() };
			else if ((m = line.match(/^ERROR (.+)$/))) exp.value = { ...exp.value, error: m[1].trim() };
		};
		proc.stdout.on('data', (d) => { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach(onLine); });
		proc.stderr.on('data', (d) => nodecg.log.warn('[export-stinger]', String(d).trim()));
		proc.on('close', (code) => {
			clearTimeout(timeout);
			if (buf) onLine(buf);
			child = null; writing = null;
			const ok = code === 0 && exp.value.path;
			exp.value = { ...exp.value, running: false, error: ok ? null : exp.value.error || `Échec de l'export (code ${code})` };
			nodecg.log.info(ok ? `Stinger exporté : ${exp.value.path}` : `Export du stinger échoué : ${exp.value.error}`);
		});
		proc.on('error', (e) => { clearTimeout(timeout); child = null; writing = null; exp.value = { ...exp.value, running: false, error: e.message }; });
		return { started: true };
	});

	// ---------- Téléchargement des exports ----------
	const router = express.Router();
	const auth = requireLogin(nodecg);
	router.get('/valorant-tournament/stinger-exports', auth, async (req, res) => {
		try {
			const names = fs.existsSync(EXPORTS) ? (await fs.promises.readdir(EXPORTS, { withFileTypes: true })).filter((d) => d.isDirectory() && EXPORT_NAME.test(d.name)).map((d) => d.name) : [];
			const list = [];
			for (const name of names) {
				const files = await exportFiles(name);
				const frames = files.filter((f) => f.name !== 'info.txt');
				// Un export inachevé n'a pas encore son info.txt (écrit à la fin)
				if (!frames.length || !files.some((f) => f.name === 'info.txt') || name === writing) continue;
				list.push({ name, frames: frames.length, bytes: files.reduce((n, f) => n + f.size, 0), at: Math.max(...files.map((f) => f.at)) });
			}
			res.json({ ok: true, exports: list.sort((a, b) => b.at - a.at) });
		} catch (e) {
			res.status(500).json({ ok: false, error: e.message });
		}
	});
	router.get('/valorant-tournament/stinger-exports/:file', auth, async (req, res) => {
		const name = String(req.params.file).replace(/\.zip$/, '');
		if (!EXPORT_NAME.test(name) || !fs.existsSync(path.join(EXPORTS, name))) return res.status(404).json({ ok: false, error: 'Export introuvable' });
		if (name === writing) return res.status(409).json({ ok: false, error: 'Export en cours : attends la fin pour le télécharger' });
		try {
			const files = await exportFiles(name);
			if (!files.length) return res.status(404).json({ ok: false, error: 'Export vide' });
			await sendZip(res, `kb-${name}.zip`, files.map((f) => ({ name: `${name}/${f.name}`, file: f.file })));
		} catch (e) {
			if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
			else res.destroy();
			if (!/interrompu/.test(e.message)) nodecg.log.warn('Téléchargement du stinger :', e.message);
		}
	});
	nodecg.mount(router);
};
