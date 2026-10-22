// API HTTP pour piloter la régie depuis Bitfocus Companion (Stream Deck…) ou tout outil qui envoie des requêtes HTTP.
// Mêmes effets que les boutons de la Régie : overlays (un seul plein écran à la fois), scène de fond, transition,
// lower thirds et presets, score de la série. Documentation complète (pour l'utilisateur) : docs/COMPANION.md et onglet Companion (dashboard/companion.html, à tenir à jour avec les routes)
//
// Protection : un jeton secret, exigé sur TOUTES les routes (Companion ne peut pas se connecter à la régie comme un navigateur).
//   Jeton : variable d'environnement COMPANION_TOKEN, sinon créé dans db/companion-token (hors sauvegardes et exports).
//   Envoyé par Companion dans l'en-tête « Authorization: Bearer <jeton> » (ou « X-Api-Key », ?key=<jeton>, ou { "key": … } dans le corps JSON).
// Paramètres des actions (kind, map, then, style, via, exclusive, fullscreen, stinger) : dans l'adresse ou dans le corps JSON.
// Pas de connexion permanente (SSE, WebSocket) : NodeCG attendrait sa fermeture pour s'arrêter. Companion interroge /state.
//
// Transition des plein écran (option « fullscreenStinger », réglée dans la Régie) : si active, afficher / masquer un overlay
// plein écran joue le stinger et fait le changement au point de coupe. Les panneaux passent par le message 'overlay:stinger'
// (KBO, shared/overlays.js), l'API par ses routes overlay : un seul moteur, dont les minuteurs tournent sur le serveur.
//
// Messages : 'companion:info' → { token, fromEnv }, 'companion:newToken' → { token } (panneau Données) ;
//            'overlay:stinger' { id, action: 'show'|'hide'|'toggle', exclusive? } → { done } (panneaux, via KBO) ;
//            'transition:cancel' → { cancelled } (Régie, « Tout masquer »)
// Routes (préfixe /valorant-tournament/api) : voir le tableau de docs/COMPANION.md et la réponse de GET /valorant-tournament/api
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const KBOList = require('../shared/overlay-list.js');
const LIVE = require('../shared/live.js');
const KBM = require('../shared/maps.js');
const { DB } = require('./lib/paths');
const { sameOrigin } = require('./lib/http');

const BASE = '/valorant-tournament/api';
const TOKEN_FILE = path.join(DB, 'companion-token');
const ITEMS = KBOList.ITEMS;
const SCENE_IDS = KBOList.SCENES.map(([id]) => id);
const DELTAS = { plus: 1, '+1': 1, 1: 1, minus: -1, '-1': -1 };

// Refus attendu (mauvais paramètre, rien à afficher…) : renvoyé tel quel à Companion avec son code HTTP
class ApiError extends Error {
	constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };

const newToken = () => crypto.randomBytes(24).toString('base64url');
function savedToken() {
	try {
		const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
		if (t.length >= 24) return t;
	} catch { /* pas encore créé */ }
	return null;
}
function createToken() {
	const t = newToken();
	fs.mkdirSync(DB, { recursive: true });
	fs.writeFileSync(TOKEN_FILE, t + '\n', { mode: 0o600 });
	return t;
}

const isObj = (v) => !!v && typeof v === 'object';
const getAt = (obj, keys) => keys.reduce((o, k) => (isObj(o) ? o[k] : undefined), obj);
// Écrit `value` au chemin `keys` sous `obj` ; un maillon manquant est créé d'un coup avec la valeur au bout (comme KBO)
function writeAt(obj, keys, value) {
	const [k, ...rest] = keys;
	if (!rest.length) obj[k] = value;
	else if (isObj(obj[k])) writeAt(obj[k], rest, value);
	else obj[k] = rest.reduceRight((v, key) => ({ [key]: v }), value);
}

module.exports = function (nodecg, listen, live) {
	const reps = {};
	const rep = (name) => (reps[name] ||= nodecg.Replicant(name));

	// ---------- Jeton ----------
	const fromEnv = !!process.env.COMPANION_TOKEN;
	let token = process.env.COMPANION_TOKEN || savedToken() || createToken();
	if (fromEnv && token.length < 16) nodecg.log.warn('COMPANION_TOKEN est très court : choisis au moins 16 caractères aléatoires.');

	// Paramètre lu dans l'adresse (?nom=), sinon dans le corps JSON de la requête (Companion : champ « Body »)
	const param = (req, name) => {
		const v = req.query[name] !== undefined ? req.query[name] : req.body[name];
		return v === undefined || v === null || isObj(v) ? undefined : String(v);
	};
	// Corps JSON facultatif, quel que soit son Content-Type (Companion envoie selon les versions JSON ou texte) ; illisible = ignoré.
	// En application/json, NodeCG l'a déjà lu (req.body est un objet) ; sinon il est lu ici comme texte.
	// JSON mal formé en application/json : refusé par NodeCG avant nos routes (500 « Internal error »), impossible à intercepter ici.
	const readBody = [
		express.text({ type: () => true, limit: '4kb' }),
		(req, res, next) => {
			let body = req.body;
			if (typeof body === 'string') { try { body = body.trim() ? JSON.parse(body) : {}; } catch { body = {}; } }
			req.body = isObj(body) && !Array.isArray(body) ? body : {};
			next();
		},
	];
	const givenToken = (req) => {
		const m = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
		return (m && m[1].trim()) || req.get('x-api-key') || param(req, 'key') || '';
	};
	const auth = (req, res, next) => {
		const a = Buffer.from(String(givenToken(req))), b = Buffer.from(token);
		if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
		res.status(401).json({ ok: false, error: 'Jeton absent ou invalide : copie-le depuis le panneau Données → Bitfocus Companion.' });
	};

	// ---------- Overlays (mêmes règles que KBO dans shared/overlays.js) ----------
	const overlay = (id) => KBOList.item(id) || fail(404, `Overlay inconnu : « ${id} ». La liste est donnée par GET ${BASE}`);
	const isVisible = (it) => !!getAt(rep(it.rep).value, it.path);
	// N'écrit que le booléen de visibilité : le reste du replicant (modifié peut-être au même moment par un panneau) est gardé
	function setVisible(it, on) {
		if (isVisible(it) === on) return;
		const r = rep(it.rep);
		if (isObj(r.value)) writeAt(r.value, it.path, on);
		else { const v = {}; writeAt(v, it.path, on); r.value = v; }
	}
	const ltSide = (it) => (it.rep === 'liveLowerThird' ? it.path[0] : null);
	const ltEmpty = (slot) => { const c = LIVE.displayContent(slot, rep('casters').value); return !c.title && !c.subtitle; };
	function show(it, exclusive = true) {
		if (!isVisible(it)) {
			const v = rep(it.rep).value || {};
			if (it.needs && !it.needs(v)) fail(409, `${it.label} : rien à afficher, à régler d'abord dans la régie.`);
			if (ltSide(it) && ltEmpty(v[ltSide(it)])) fail(409, `${it.label} : aucun texte, à régler d'abord dans la régie (ou utiliser un preset).`);
		}
		if (it.fullscreen && exclusive) for (const o of ITEMS) if (o !== it && o.fullscreen) setVisible(o, false);
		setVisible(it, true);
	}
	const hideAll = (fullscreenOnly) => { for (const it of ITEMS) if (!fullscreenOnly || it.fullscreen) setVisible(it, false); };
	function overlayAction(it, action, exclusive) {
		if (action === 'toggle') action = isVisible(it) ? 'hide' : 'show';
		if (action === 'show') show(it, exclusive);
		else if (action === 'hide') setVisible(it, false);
		else fail(404, `Action inconnue : « ${action} » (show, hide ou toggle).`);
		return `${it.label} ${action === 'show' ? 'affiché' : 'masqué'}`;
	}

	// ---------- Scène de fond (comme la Régie : masque d'abord les plein écran ; « none » = retour au jeu, sans eux) ----------
	function setScene(scene, via = 'fade') {
		if (!SCENE_IDS.includes(scene)) fail(404, `Scène inconnue : « ${scene} » (${SCENE_IDS.join(', ')}).`);
		if (via !== 'fade' && via !== 'cut') fail(400, `Passage inconnu : « ${via} » (fade ou cut).`);
		hideAll(true);
		// Même scène : rien à réécrire (stream.html rejouerait son entrée)
		if ((rep('streamScene').value || {}).scene === scene) return;
		rep('streamScene').value = { scene, via, at: Date.now() };
	}
	const clearScreen = () => {
		hideAll(false);
		rep('streamScene').value = { scene: 'none', via: 'cut', at: Date.now() };
	};

	// ---------- Transition (stinger) + action faite pendant que l'écran est couvert ----------
	let pending = null; // { then, timer } : action prévue au point de coupe de la transition en cours
	const cancelPending = () => { if (!pending) return false; clearTimeout(pending.timer); pending = null; return true; };

	function parseThen(then) {
		if (!then || then === 'none') return null;
		if (then === 'clear') return then;
		if (then.startsWith('scene:')) { const s = then.slice(6); if (!SCENE_IDS.includes(s)) fail(404, `Scène inconnue : « ${s} ».`); return then; }
		if (then.startsWith('overlay:')) {
			const it = overlay(then.slice(8));
			if (it.needs && !it.needs(rep(it.rep).value || {})) fail(409, `${it.label} : rien à afficher, à régler d'abord dans la régie.`);
			return then;
		}
		if (then.startsWith('hide:')) { overlay(then.slice(5)); return then; }
		fail(400, `then inconnu : « ${then} » (none, clear, scene:<scène>, overlay:<overlay> ou hide:<overlay>).`);
	}
	function applyThen(then, exclusive = true) {
		if (then === 'clear') clearScreen();
		else if (then.startsWith('scene:')) setScene(then.slice(6), 'cut');
		else if (then.startsWith('overlay:')) show(overlay(then.slice(8)), exclusive);
		else if (then.startsWith('hide:')) setVisible(overlay(then.slice(5)), false);
	}
	function findMap(name) {
		const maps = Object.keys((rep('valorantData').value || {}).maps || {});
		if (!maps.length) return name; // données Valorant pas encore chargées : on fait confiance
		return maps.find((n) => n.toLowerCase() === name.toLowerCase()) || fail(404, `Map inconnue : « ${name} » (${maps.join(', ')}).`);
	}
	// Style d'une seule transition (préréglage intégré ou perso du panneau Maps & Transitions) ; absent = réglages enregistrés
	function findStyle(style) {
		if (style == null || style === '' || style === 'default') return null;
		const cur = rep('mapsTransitionSettings').value;
		return KBM.trStyle(cur, style)
			|| fail(404, `Style de transition inconnu : « ${style} » (${KBM.trStyles(cur).map((x) => x.id).join(', ')}).`);
	}
	function transition({ kind, map, then, style, exclusive = true }) {
		if (kind && !KBM.TR_KINDS[kind]) fail(400, `Type de transition inconnu : « ${kind} » (${Object.keys(KBM.TR_KINDS).join(', ')}).`);
		const st = findStyle(style);
		kind = kind || (map ? 'map' : 'logo');
		if (kind === 'map') {
			if (map) map = findMap(map);
			else {
				const m = rep('match').value || {};
				const cur = (m.maps || [])[m.currentMap];
				map = (cur && cur.map) || fail(409, 'Aucune map en cours dans le match : précise la map (?map=Ascent).');
			}
		} else map = null;
		const dest = parseThen(then);
		const t = KBM.stingerTiming(st ? st.settings : KBM.trSettings(rep('mapsTransitionSettings').value), kind);
		rep('transition').value = st ? { at: Date.now(), map, kind, style: st.id } : { at: Date.now(), map, kind };
		cancelPending();
		if (dest) {
			// Au point de coupe, sauf une scène de fond : demandée dès le début de la couverture (comme la Régie)
			const at = dest.startsWith('scene:') && t.covered ? t.coveredFrom : t.cut;
			pending = {
				then: dest,
				timer: setTimeout(() => {
					pending = null;
					try { applyThen(dest, exclusive); } catch (e) { nodecg.log.warn(`Companion : action après la transition impossible (${dest}) : ${e.message}`); }
				}, at),
			};
		}
		return { done: `Transition ${kind === 'map' ? '+ ' + map : kind}${st ? ` (${st.label})` : ''} lancée${dest ? ' → ' + dest : ''}`, kind, map, then: dest, style: st ? st.id : null, duration: t.duration, actionAt: dest ? (dest.startsWith('scene:') && t.covered ? t.coveredFrom : t.cut) : null };
	}

	// ---------- Plein écran avec transition (option fullscreenStinger) ----------
	const fsStinger = nodecg.Replicant('fullscreenStinger', { defaultValue: { ...KBOList.STINGER_DEFAULT } });
	const stingerOn = () => !!(fsStinger.value && fsStinger.value.enabled);
	/**
	 * Affiche / masque un plein écran derrière le stinger (logo) : le changement est fait au point de coupe.
	 * Passer d'un plein écran à un autre = une seule transition (l'ancien est masqué à la coupe, en même temps).
	 * Rien à changer (déjà dans l'état demandé) : pas de transition.
	 */
	function stingOverlay(it, action, exclusive = true) {
		if (action === 'toggle') action = isVisible(it) ? 'hide' : 'show';
		if (action !== 'show' && action !== 'hide') fail(404, `Action inconnue : « ${action} » (show, hide ou toggle).`);
		const others = exclusive ? ITEMS.filter((o) => o !== it && o.fullscreen && isVisible(o)) : [];
		if (action === 'hide' ? !isVisible(it) : isVisible(it) && !others.length) return { done: `${it.label} déjà ${action === 'show' ? 'affiché' : 'masqué'}` };
		const r = transition({ kind: 'logo', then: (action === 'show' ? 'overlay:' : 'hide:') + it.id, exclusive });
		return { ...r, done: `Transition → ${it.label} ${action === 'show' ? 'affiché' : 'masqué'}${others.length ? ` (remplace ${others.map((o) => o.label).join(', ')})` : ''}` };
	}
	// Plein écran + option active (et pas ?stinger=0) : par la transition ; sinon tout de suite
	const overlayRequest = (it, action, exclusive, stinger = true) => (it.fullscreen && stinger && stingerOn()
		? stingOverlay(it, action, exclusive) : overlayAction(it, action, exclusive));

	// ---------- Lower thirds ----------
	const side = (s) => (LIVE.SIDE_KEYS.includes(s) ? s : fail(404, `Emplacement inconnu : « ${s} » (${LIVE.SIDE_KEYS.join(', ')}).`));
	// Même écriture que le formulaire des panneaux (writeSlot de shared/lt-form.js) : champ par champ
	function writeSlot(s, obj) {
		const lt = rep('liveLowerThird');
		const v = lt.value;
		if (v && isObj(v[s])) {
			for (const [k, x] of Object.entries(obj)) if (v[s][k] !== x) v[s][k] = x;
		} else {
			const n = LIVE.normalizeLowerThird(v);
			Object.assign(n[s], obj);
			lt.value = n;
		}
	}
	// Presets enregistrés + presets automatiques (intervenants, pause technique, prochain match), comme dans les panneaux
	function presets() {
		const kb = {
			rep: { casters: rep('casters'), schedule: rep('schedule'), match: rep('match') },
			team: (id) => (id && (rep('teams').value || {})[id]) || null,
		};
		return [...(rep('liveLowerThirdPresets').value || []), ...LIVE.autoPresets(kb)];
	}
	function findPreset(key) {
		const list = presets();
		const k = String(key).toLowerCase();
		const n = /^caster-(\d+)$/.exec(k);
		const alias = n ? 'auto:caster:' + (+n[1] - 1) : { pause: 'auto:pause', next: 'auto:next' }[k];
		return list.find((p) => p.id === key || (alias && p.id === alias)) || list.find((p) => String(p.name || '').toLowerCase() === k)
			|| fail(404, `Preset inconnu : « ${key} ». La liste est donnée par GET ${BASE}`);
	}

	// ---------- État lu par Companion (retours visuels des boutons, textes) ----------
	function state() {
		const m = rep('match').value || {};
		const teams = rep('teams').value || {};
		const team = (id) => { const t = id && teams[id]; return { name: (t && t.name) || '', tag: (t && (t.tag || t.name)) || '' }; };
		const score = { A: 0, B: 0 };
		for (const x of m.maps || []) if (x && (x.winner === 'A' || x.winner === 'B')) score[x.winner]++;
		const cur = (m.maps || [])[m.currentMap];
		const lt = rep('liveLowerThird').value || {};
		const casters = rep('casters').value || [];
		const onAir = ITEMS.filter(isVisible).map((it) => it.id);
		return {
			scene: (rep('streamScene').value || {}).scene || 'none',
			overlays: Object.fromEntries(ITEMS.map((it) => [it.id, onAir.includes(it.id)])),
			onAir,
			fullscreen: (ITEMS.find((it) => it.fullscreen && onAir.includes(it.id)) || {}).id || null,
			lowerThirds: Object.fromEntries(LIVE.SIDE_KEYS.map((k) => {
				const slot = lt[k] || {};
				const c = LIVE.displayContent(slot, casters);
				return [k, { visible: !!slot.visible, kicker: c.kicker, title: c.title, subtitle: c.subtitle }];
			})),
			match: {
				teamA: team(m.teamA), teamB: team(m.teamB), scoreA: score.A, scoreB: score.B,
				format: m.format || '', stage: m.stage || '', swap: !!m.swap,
				map: cur ? { number: (+m.currentMap || 0) + 1, name: cur.map || '', scoreA: +cur.scoreA || 0, scoreB: +cur.scoreB || 0 } : null,
			},
			transition: { pending: !!pending, then: pending ? pending.then : null },
			fullscreenStinger: stingerOn(),
		};
	}

	// ---------- Routes ----------
	const router = express.Router();
	router.use(BASE, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, readBody, auth);

	// Exécute une action : { ok: true, done, ..., state } ; refus : { ok: false, error } avec le code HTTP adapté
	const action = (fn) => (req, res) => {
		try {
			const r = fn(req) || {};
			const out = typeof r === 'string' ? { done: r } : r;
			if (out.done) nodecg.log.info(`Companion : ${out.done}`);
			res.json({ ok: true, ...out, state: state() });
		} catch (e) {
			const status = e instanceof ApiError ? e.status : 500;
			if (status === 500) nodecg.log.error('Companion : erreur', e.stack || e.message);
			res.status(status).json({ ok: false, error: e.message });
		}
	};
	const post = (route, fn) => router.post(BASE + route, sameOrigin, action(fn));
	const flag = (v, def) => (v === undefined ? def : !['0', 'false', 'no', 'non'].includes(String(v).toLowerCase()));

	// Tout ce que l'API accepte, avec les valeurs du moment (aide à la configuration des boutons)
	router.get(BASE, (req, res) => res.json({
		ok: true,
		overlays: ITEMS.map((it) => ({ id: it.id, label: it.label, fullscreen: !!it.fullscreen })),
		scenes: KBOList.SCENES.map(([id, label]) => ({ id, label })),
		lowerThirdSides: LIVE.SIDE_KEYS,
		presets: presets().map((p) => ({ id: p.id, name: p.name })),
		transitionKinds: Object.keys(KBM.TR_KINDS),
		transitionStyles: KBM.trStyles(rep('mapsTransitionSettings').value),
		maps: Object.keys((rep('valorantData').value || {}).maps || {}),
	}));
	router.get(BASE + '/state', (req, res) => res.json({ ok: true, ...state() }));
	// Une seule valeur de l'état, en texte brut : /value/overlays/versus → true ; /value/match/scoreA → 1
	router.get(new RegExp('^' + BASE + '/value/(.+)$'), (req, res) => {
		const v = getAt(state(), req.params[0].split('/').filter(Boolean).map(decodeURIComponent));
		if (v === undefined) return res.status(404).type('text').send('');
		res.type('text').send(v === null ? '' : isObj(v) ? JSON.stringify(v) : String(v));
	});

	post('/overlay/:id/:action', (req) => overlayRequest(overlay(req.params.id), req.params.action, flag(param(req, 'exclusive'), true), flag(param(req, 'stinger'), true)));
	// Option « transition des plein écran » (comme la case de la Régie)
	post('/option/fullscreen-stinger/:value', (req) => {
		const v = req.params.value;
		if (!['on', 'off', 'toggle'].includes(v)) fail(404, `Valeur inconnue : « ${v} » (on, off ou toggle).`);
		const on = v === 'toggle' ? !stingerOn() : v === 'on';
		fsStinger.value = { ...(fsStinger.value || {}), enabled: on };
		return `Transition des plein écran ${on ? 'activée' : 'désactivée'}`;
	});
	post('/overlays/hide-all', (req) => {
		const fullscreenOnly = flag(param(req, 'fullscreen'), false);
		hideAll(fullscreenOnly);
		return fullscreenOnly ? 'Overlays plein écran masqués' : 'Tous les overlays masqués';
	});
	post('/clear', () => {
		// Une transition lancée attend peut-être son point de coupe : son action ne doit plus repasser à l'antenne
		const cancelled = cancelPending();
		clearScreen();
		return `Tout masqué, retour au jeu${cancelled ? ' (action de la transition annulée)' : ''}`;
	});
	post('/scene/:scene', (req) => { setScene(req.params.scene, param(req, 'via') || 'fade'); return `Scène de fond : ${req.params.scene}`; });
	post('/transition', (req) => transition({ kind: param(req, 'kind'), map: param(req, 'map'), then: param(req, 'then'), style: param(req, 'style') }));
	// Ralenti en un appel (mêmes actions que les boutons « Replay + bug » / « Fin du replay » de la Régie)
	post('/replay/start', (req) => transition({ kind: 'replay', then: 'overlay:replay-bug', style: param(req, 'style') }));
	// Fin : le bug sort d'abord, le stinger est joué une fois sa sortie finie (LIVE.REPLAY_BUG_OUT_MS) ; /clear l'annule
	post('/replay/end', (req) => {
		const style = param(req, 'style');
		const st = findStyle(style); // style inconnu : refusé avant de masquer le bug
		const bug = KBOList.item('replay-bug');
		if (!isVisible(bug)) return transition({ kind: 'replay', style });
		cancelPending();
		setVisible(bug, false);
		const wait = LIVE.REPLAY_BUG_OUT_MS;
		pending = {
			then: 'stinger:replay',
			timer: setTimeout(() => {
				pending = null;
				try { transition({ kind: 'replay', style }); } catch (e) { nodecg.log.warn(`Companion : transition replay impossible : ${e.message}`); }
			}, wait),
		};
		return { done: `Bug Replay masqué, transition replay${st ? ` (${st.label})` : ''} dans ${wait} ms`, kind: 'replay', then: null, style: st ? st.id : null, stingerAt: wait };
	});
	post('/transition/cancel', () => (cancelPending() ? 'Action de la transition annulée' : { done: '', cancelled: false }));
	post('/lower-third/:side/preset/:preset', (req) => {
		const s = side(req.params.side);
		const p = findPreset(req.params.preset);
		writeSlot(s, LIVE.presetContent(p));
		show(KBOList.item('lower-third-' + s));
		return `Lower third ${s} : preset « ${p.name} » affiché`;
	});
	post('/lower-third/:side/:action', (req) => overlayAction(KBOList.item('lower-third-' + side(req.params.side)), req.params.action));
	post('/score/:team/:delta', (req) => {
		if (!live) fail(503, 'Partie « live » du serveur indisponible (voir le journal au démarrage).');
		const team = String(req.params.team).toUpperCase();
		const delta = DELTAS[String(req.params.delta).toLowerCase()];
		if (!['A', 'B'].includes(team)) fail(404, `Équipe inconnue : « ${req.params.team} » (A ou B).`);
		if (!delta) fail(404, `Variation inconnue : « ${req.params.delta} » (plus ou minus).`);
		try {
			const r = live.series(team, delta);
			return { done: `Score de série ${delta > 0 ? '+1' : '−1'} équipe ${team} → ${r.A}-${r.B}`, ...r };
		} catch (e) { if (e instanceof TypeError || e instanceof ReferenceError) throw e; fail(409, e.message); }
	});
	router.all(new RegExp('^' + BASE + '(/.*)?$'), (req, res) => res.status(404).json({ ok: false, error: `Route inconnue : ${req.method} ${req.path}. Voir docs/COMPANION.md` }));
	nodecg.mount(router);

	// ---------- Panneau Données : afficher / renouveler le jeton ----------
	listen('companion:info', () => ({ token, fromEnv }));
	// Régie « Tout masquer » : une action de transition en attente (plein écran demandé juste avant) ne doit plus avoir lieu
	listen('transition:cancel', () => ({ cancelled: cancelPending() }));
	// Panneaux (KBO) : plein écran par la transition quand l'option est active (même moteur que l'API)
	listen('overlay:stinger', ({ id, action, exclusive }) => {
		const r = stingOverlay(overlay(String(id)), String(action), exclusive !== false);
		nodecg.log.info(`Régie : ${r.done}`);
		return { done: r.done };
	});
	listen('companion:newToken', () => {
		if (fromEnv) throw new Error('Le jeton est fixé par la variable COMPANION_TOKEN : change-la chez ton hébergeur puis relance.');
		token = createToken();
		nodecg.log.info('Companion : nouveau jeton créé (l\'ancien ne marche plus)');
		return { token };
	});
};
