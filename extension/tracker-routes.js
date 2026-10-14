// Routes HTTP de l'import tracker.gg (montées sur la racine du serveur NodeCG) :
//   POST /valorant-tournament/tracker-import?playlist=   JSON brut tracker.gg (text/plain) → { ok, id, riotId } | { ok:false, error }
//   GET  /valorant-tournament/tracker-receiver           fenêtre ouverte par le favori (static/tracker-receiver.html)
//   GET  /valorant-tournament/tracker-status             état lu par les panneaux et la popup de l'extension
//   GET  /valorant-tournament/tracker-extension          guide d'installation de l'extension (README rendu en HTML)
const fs = require('fs');
const path = require('path');
const express = require('express');
const { EXT_DIR, STATIC } = require('./lib/paths');
const { loginEnabled, requireLogin, sameOrigin } = require('./lib/http');

module.exports = function (nodecg, tracker) {
	const profiles = nodecg.Replicant('playerProfiles');
	const router = express.Router();

	// Envoyé en text/plain : le body-parser JSON global de NodeCG limite la taille à 100 ko.
	// Toujours appelé depuis une page de la régie (panneau, fenêtre du favori, extension via la page) : même origine.
	router.post('/valorant-tournament/tracker-import',
		requireLogin(nodecg, 'Connecte-toi à la régie NodeCG (même navigateur) puis réessaie.'), sameOrigin,
		express.text({ type: '*/*', limit: '20mb' }),
		(req, res) => {
			try {
				const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
				const p = tracker.store(body, String(req.query.playlist || 'competitive'));
				res.json({ ok: true, id: p.id, riotId: p.riotId });
			} catch (e) {
				res.status(400).json({ ok: false, error: e.message });
			}
		});

	router.get('/valorant-tournament/tracker-receiver', (req, res) => {
		res.sendFile(path.join(STATIC, 'tracker-receiver.html'));
	});

	// La popup de l'extension l'interroge depuis son origine chrome-extension:// ou moz-extension:// (d'où le CORS ouvert).
	// Le dossier sur le disque et le nombre de profils ne sont donnés qu'aux personnes autorisées.
	router.get('/valorant-tournament/tracker-status', (req, res) => {
		res.set('Access-Control-Allow-Origin', '*');
		let version = null;
		try { version = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8')).version; } catch { /* absent */ }
		const allowed = !loginEnabled(nodecg) || !!req.user;
		res.json(allowed
			? { ok: true, bundle: 'valorant-tournament', profiles: Object.keys(profiles.value || {}).length, extension: { dir: EXT_DIR, version } }
			: { ok: true, bundle: 'valorant-tournament', extension: { version } });
	});

	router.get('/valorant-tournament/tracker-extension', requireLogin(nodecg), (req, res) => {
		let md = '';
		try { md = fs.readFileSync(path.join(EXT_DIR, 'README.md'), 'utf8'); } catch { md = '# README introuvable\n\nDossier attendu : ' + EXT_DIR; }
		const page = fs.readFileSync(path.join(STATIC, 'tracker-guide.html'), 'utf8');
		res.type('html').send(page.replace('{{DIR}}', () => esc(EXT_DIR)).replace('{{CONTENU}}', () => markdown(md)));
	});

	nodecg.mount(router);
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Mini rendu Markdown (titres, listes, code, gras, liens, citations) suffisant pour le README de l'extension
function markdown(md) {
	const inline = (s) => esc(s)
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
		.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
	const out = [];
	let list = null, code = null;
	const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
	for (const line of md.split(/\r?\n/)) {
		if (code !== null) {
			if (/^```/.test(line)) { out.push(`<pre>${esc(code.join('\n'))}</pre>`); code = null; } else code.push(line);
			continue;
		}
		if (/^```/.test(line)) { closeList(); code = []; continue; }
		let m;
		if ((m = line.match(/^(#{1,3})\s+(.*)/))) { closeList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
		if ((m = line.match(/^\s*(\d+)\.\s+(.*)/)) || (m = line.match(/^\s*[-*]\s+(.*)/))) {
			const type = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
			if (list !== type) { closeList(); out.push(`<${type}>`); list = type; }
			out.push(`<li>${inline(m[m.length - 1])}</li>`);
			continue;
		}
		if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
		if (!line.trim()) { closeList(); continue; }
		closeList();
		out.push(`<p>${inline(line)}</p>`);
	}
	closeList();
	return out.join('\n');
}
