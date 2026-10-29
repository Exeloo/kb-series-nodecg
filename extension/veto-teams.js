// Veto joué par les équipes elles-mêmes : chaque équipe reçoit un lien secret (un pour A, un pour B) vers une page
// où elle bannit / pick ses maps et choisit son côté quand c'est son tour. Ses choix écrivent le replicant `veto`,
// exactement comme le panneau Veto : le graphique suit tout seul, et la régie garde la main (annuler, cliquer à leur place…).
// Les pages équipes n'utilisent PAS NodeCG (aucun accès au reste de la régie) : HTTP simple, protégé par le jeton du lien.
//
// Replicants :
//   vetoTeams     (persisté)     { open: bool, tokens: { A, B } }  open = false : les pages équipes sont en lecture seule
//   vetoTeamsInfo (non persisté) { urls: [adresses réseau du serveur], lan: bool, online: { A: bool, B: bool } }
// Message : 'vetoTeams:newLinks' → { tokens }  (nouveaux liens : les anciens ne marchent plus)
// Routes (montées sur la racine du serveur) :
//   GET  /valorant-tournament/veto/:token          page de l'équipe (static/veto-team.html)
//   GET  /valorant-tournament/veto/:token/state?v= état (interrogé chaque seconde ; 204 si rien n'a changé depuis la version v)
//   POST /valorant-tournament/veto/:token/action   { type: 'map', map, index } | { type: 'side', side, index }
//   GET  /valorant-tournament/veto-assets/...      polices et logo du tournoi pour la page
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const express = require('express');
const M = require('../shared/match.js');
const { ROOT, STATIC } = require('./lib/paths');
const { sameOrigin } = require('./lib/http');

const newToken = () => crypto.randomBytes(18).toString('base64url');
const TEAMS = ['A', 'B'];
const VIRTUAL = /docker|^br-|veth|virbr|vmnet|vbox|wsl|vethernet|hyper-v|zt|tailscale/i;

module.exports = function (nodecg, listen) {
	const links = nodecg.Replicant('vetoTeams', { defaultValue: { open: true, tokens: { A: newToken(), B: newToken() } } });
	const info = nodecg.Replicant('vetoTeamsInfo', { defaultValue: {}, persistent: false });
	const veto = nodecg.Replicant('veto');
	const plan = nodecg.Replicant('matchVeto', { defaultValue: JSON.parse(JSON.stringify(M.MATCH_DEFAULTS.matchVeto)) });
	const match = nodecg.Replicant('match');
	const teams = nodecg.Replicant('teams');
	const tournament = nodecg.Replicant('tournament');
	const valorantData = nodecg.Replicant('valorantData');

	// Valeur incomplète (première version, fichier modifié à la main) : complétée
	const lv = links.value || {};
	if (typeof lv.open !== 'boolean' || !lv.tokens || TEAMS.some((k) => typeof lv.tokens[k] !== 'string' || lv.tokens[k].length < 16)) {
		links.value = { open: lv.open !== false, tokens: Object.fromEntries(TEAMS.map((k) => [k, (lv.tokens && lv.tokens[k] && lv.tokens[k].length >= 16) ? lv.tokens[k] : newToken()])) };
	}

	// Adresses où les équipes peuvent joindre le serveur (le panneau en tire les liens à envoyer)
	const cfg = nodecg.config || {};
	const port = cfg.port || 9090;
	const lan = !['127.0.0.1', 'localhost', '::1'].includes(cfg.host);
	// NODECG_BASE_URL (cfg/nodecg.js) : adresse publique choisie à la main ; sinon les adresses IPv4 de ce PC
	const publicUrl = process.env.NODECG_BASE_URL;
	const urls = publicUrl ? [/^https?:\/\//.test(publicUrl) ? publicUrl.replace(/\/$/, '') : 'http://' + publicUrl.replace(/\/$/, '')]
		: Object.entries(os.networkInterfaces())
			.flatMap(([name, list]) => (list || []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, address: a.address })))
			// Réseaux virtuels (Docker, WSL, machines virtuelles) en dernier : le premier lien doit être celui du Wi-Fi / Ethernet
			.sort((x, y) => VIRTUAL.test(x.name) - VIRTUAL.test(y.name))
			.map((a) => `http://${a.address}:${port}`);
	// Équipe « connectée » : sa page a demandé l'état il y a moins de 5 s
	const seen = { A: 0, B: 0 };
	const onlineNow = () => Object.fromEntries(TEAMS.map((k) => [k, Date.now() - seen[k] < 5000]));
	let shown = '';
	// Régie sur place reliée à la régie en ligne (extension/sync.js) : les équipes jouent en ligne, ces infos viennent de là-bas
	const sync = nodecg.Replicant('syncStatus', { defaultValue: {}, persistent: false });
	const publishInfo = () => { if ((sync.value || {}).role === 'client') return; const o = onlineNow(), sig = JSON.stringify(o); if (sig !== shown || !info.value || !info.value.urls) { shown = sig; info.value = { urls, lan, online: o }; } };
	publishInfo();
	setInterval(publishInfo, 2000).unref();

	const teamOf = (token) => {
		const tokens = (links.value && links.value.tokens) || {};
		const given = Buffer.from(String(token || ''));
		return TEAMS.find((k) => { const t = Buffer.from(String(tokens[k] || '')); return t.length === given.length && crypto.timingSafeEqual(t, given); }) || null;
	};

	// ---------- Vue envoyée à la page d'une équipe (tout est calculé ici : la page ne fait qu'afficher) ----------
	const teamInfo = (k) => {
		const m = match.value || {};
		const t = (teams.value || {})[k === 'A' ? m.teamA : m.teamB];
		const color = t && /^#[0-9a-f]{3,8}$/i.test(t.color) ? t.color : k === 'B' ? '#ff4655' : '#3b8fe6';
		// Seuls les logos publics (URL web ou image intégrée) : les assets NodeCG demandent d'être connecté à la régie
		const logo = t && typeof t.logo === 'string' && /^(https?:|data:image\/)/i.test(t.logo) ? t.logo : '';
		return { key: k, name: t ? t.name : 'Équipe ' + k, tag: t ? t.tag || t.name : 'Équipe ' + k, color, logo };
	};
	const sideTeamOf = (steps, i) => steps[i].sideTeam || M.defaultSideTeam(steps, i);

	function view(me) {
		const v = veto.value || {}, steps = v.steps || [], pool = v.pool || [];
		const seq = (plan.value && plan.value.sequence) || [];
		const st = M.vetoState(v, seq);
		const open = !!(links.value && links.value.open);
		let phase, turn = null;
		if (!pool.length || !seq.length) phase = 'setup';
		else if (st.pendingSide >= 0) {
			const k = sideTeamOf(steps, st.pendingSide);
			turn = { action: 'side', team: k, map: steps[st.pendingSide].map };
			phase = k === me ? 'side' : 'wait';
		} else if (st.next) {
			turn = { action: st.next.action, team: st.next.team || null };
			phase = st.next.action !== 'decider' && st.next.team === me ? 'map' : 'wait';
		} else phase = 'done';
		if (!open && (phase === 'map' || phase === 'side')) phase = 'paused';
		const maps = pool.map((name) => {
			const i = steps.findIndex((s) => s.map === name), s = steps[i];
			const d = valorantData.value && valorantData.value.maps && valorantData.value.maps[name];
			return { name, img: (d && (d.listView || d.splash)) || '', action: s ? s.action : null, team: s ? s.team : null, side: s ? s.side || null : null, sideTeam: s && s.action !== 'ban' ? sideTeamOf(steps, i) : null };
		});
		const history = seq.map((p, i) => {
			const s = steps[i];
			return s ? { action: s.action, team: s.team, map: s.map, side: s.side || null, sideTeam: s.action !== 'ban' ? sideTeamOf(steps, i) : null, done: true }
				: { action: p.action, team: p.team || null, done: false };
		});
		const m = match.value || {};
		return {
			me, open, phase, turn, index: steps.length, total: seq.length, maps, history,
			teams: { A: teamInfo('A'), B: teamInfo('B') },
			title: (tournament.value && tournament.value.name) || '', stage: [m.stage, (m.format || '').toUpperCase()].filter(Boolean).join(' · '),
		};
	}

	// ---------- Actions d'une équipe (refusées si ce n'est pas son tour : la régie a pu jouer entre-temps) ----------
	function act(me, body) {
		if (!links.value.open) throw new Error('Le veto est en pause : attends le feu vert de la régie.');
		const v = veto.value || {}, steps = v.steps || [], pool = v.pool || [];
		const seq = (plan.value && plan.value.sequence) || [];
		const st = M.vetoState(v, seq);
		if (+body.index !== steps.length) throw new Error('Le veto a avancé entre-temps : vérifie l\'écran et recommence.');
		if (body.type === 'side') {
			if (st.pendingSide < 0) throw new Error('Aucun côté à choisir pour le moment.');
			if (sideTeamOf(steps, st.pendingSide) !== me) throw new Error('Ce n\'est pas à ton équipe de choisir le côté.');
			if (!M.SIDE_FR[body.side]) throw new Error('Côté inconnu.');
			const next = steps.map((s) => ({ ...s }));
			next[st.pendingSide] = { ...next[st.pendingSide], sideTeam: me, side: body.side };
			veto.value = { ...v, steps: next };
			return `${M.SIDE_FR[body.side]} sur ${next[st.pendingSide].map}`;
		}
		if (body.type !== 'map') throw new Error('Action inconnue.');
		if (st.pendingSide >= 0) throw new Error('Un côté doit d\'abord être choisi.');
		if (!st.next) throw new Error('Le veto est terminé.');
		if (st.next.action === 'decider' || st.next.team !== me) throw new Error('Ce n\'est pas le tour de ton équipe.');
		const map = String(body.map || '');
		if (!pool.includes(map)) throw new Error('Cette map n\'est pas dans le pool.');
		if (st.used.has(map)) throw new Error('Cette map a déjà été choisie ou bannie.');
		const step = { action: st.next.action, team: me, map, side: null, sideTeam: null };
		const next = [...steps.map((s) => ({ ...s })), step];
		if (step.action !== 'ban') step.sideTeam = M.defaultSideTeam(next, next.length - 1);
		// Decider : la dernière map restante est jouée d'office, l'équipe désignée choisira ensuite son côté
		const after = M.vetoState({ ...v, steps: next }, seq);
		if (after.next && after.next.action === 'decider' && after.pendingSide < 0) {
			const left = pool.filter((p) => !after.used.has(p));
			if (left.length === 1) {
				const dec = { action: 'decider', team: null, map: left[0], side: null, sideTeam: null };
				next.push(dec);
				dec.sideTeam = M.defaultSideTeam(next, next.length - 1);
			}
		}
		veto.value = { ...v, steps: next };
		return `${M.ACTION_FR[step.action]} ${map}`;
	}

	// ---------- Routes ----------
	const router = express.Router();
	const base = '/valorant-tournament/veto/:token';
	const noStore = (req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex'); next(); };
	const auth = (req, res, next) => {
		req.team = teamOf(req.params.token);
		if (!req.team) return res.status(404).type('text').send('Lien de veto invalide ou remplacé : demande le nouveau lien à la régie.');
		next();
	};

	router.get(base, noStore, auth, (req, res) => res.sendFile(path.join(STATIC, 'veto-team.html')));

	// Pas de connexion permanente (Server-Sent Events, WebSocket) : elle empêcherait NodeCG de s'arrêter / redémarrer.
	// La page demande l'état chaque seconde en donnant la version qu'elle a déjà : 204 si rien n'a changé.
	router.get(base + '/state', noStore, auth, (req, res) => {
		if (!seen[req.team] || Date.now() - seen[req.team] >= 5000) { seen[req.team] = Date.now(); publishInfo(); } else seen[req.team] = Date.now();
		if (String(req.query.v) === String(version)) return res.status(204).end();
		res.json({ version, ...view(req.team) });
	});

	router.post(base + '/action', noStore, auth, sameOrigin, express.json({ limit: '4kb' }), (req, res) => {
		try {
			const done = act(req.team, req.body || {});
			nodecg.log.info(`Veto joué par l'équipe ${req.team} (${teamInfo(req.team).tag}) : ${done}`);
			res.json({ ok: true, done });
		} catch (e) {
			res.status(409).json({ ok: false, error: e.message });
		}
	});

	router.use('/valorant-tournament/veto-assets/fonts', express.static(path.join(ROOT, 'shared', 'fonts'), { maxAge: '1d' }));
	router.get('/valorant-tournament/veto-assets/logo.png', (req, res) => res.sendFile(path.join(ROOT, 'shared', 'img', 'kbs-logo.png')));
	nodecg.mount(router);

	// ---------- Version de l'état : change dès qu'une donnée affichée par les pages équipes change ----------
	let version = Date.now();
	for (const rep of [veto, plan, match, teams, tournament, valorantData, links]) rep.on('change', () => { version++; });

	listen('vetoTeams:newLinks', () => {
		links.value = { ...links.value, tokens: { A: newToken(), B: newToken() } };
		return { tokens: links.value.tokens };
	});
};
