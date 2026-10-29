// Synchronisation en direct de deux régies : une EN LIGNE (veto des équipes, choix des maps, régie à distance)
// et une SUR PLACE (overlays d'OBS / vMix servis en local : aucune latence Internet sur les transitions).
// La régie sur place se connecte à celle en ligne (WebSocket sortant : aucun port à ouvrir sur place) et les
// replicants de données sont recopiés dans les deux sens, champ par champ : deux personnes qui modifient des champs
// différents au même moment ne s'écrasent pas. Sur un même champ modifié des deux côtés à la fois, la régie en ligne tranche.
// Les logos et photos (assets) sont recopiés de la régie en ligne vers celle sur place (un seul sens).
//
// Rôles :
//   relais (en ligne)  accepte les régies sur place qui donnent son jeton (SYNC_TOKEN, sinon db/sync-token)
//   relié (sur place)  adresse + jeton de la régie en ligne : SYNC_URL + SYNC_TOKEN, sinon panneau Données (db/sync.json)
// Une régie reliée n'accepte pas elle-même d'autre régie (pas de chaîne).
//
// (Re)connexion :
//   - premier contact après le démarrage : les données de la régie en ligne priment ;
//   - après une coupure : les modifications faites sur place pendant la coupure sont fusionnées dans celles d'en ligne ;
//   - sauvegarde avant, si des données d'ici changent (au plus une fois par 10 min après une coupure) ;
//   - jamais de surprise à l'antenne : un overlay affiché ici le reste avec son contenu, un masqué reste masqué ;
//     la scène de fond et la dernière transition restent celles d'ici.
//
// Replicant : syncStatus (non persisté) { role: 'hub' | 'client', clients | url, connected, since, error, assets }
// Messages : sync:info → { token, tokenFromEnv, url, urlFromEnv } ; sync:connect { url, token } ; sync:disconnect ; sync:newToken → { token }
// Protocole : espace socket.io /kb-sync du serveur NodeCG (même port, même adresse). Messages 'm' = JSON [type, données] :
//   relais → relié : snapshot { values }, ops { name, ops }, ack { name, seq, value }, full { name, value }
//   relié → relais : ops { name, ops, seq }, want { name } ; au-delà de CHUNK, découpé en 'part' (socket.io refuse plus de 1 Mo reçu)
//   assets : 'assets:list' et 'assets:get' (avec réponse) ; 'assets:changed' (relais → relié)
// Une opération = { p: chemin, v: valeur } (v absent = suppression) ; p = [] remplace toute la valeur.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { io: connectTo } = require('socket.io-client');
const { NAMES, OVERLAYS } = require('./lib/backup');
const { ROOT, DB, ASSETS } = require('./lib/paths');

const NSP = '/kb-sync';
const TOKEN_FILE = path.join(DB, 'sync-token');
const CONFIG_FILE = path.join(DB, 'sync.json');
const MIRROR_FILE = path.join(DB, 'sync-assets.json');
// Recopiés dans les deux sens / seulement de la régie en ligne vers celle sur place
const BOTH = [...NAMES, 'transition', 'vetoTeams'];
const DOWN = ['valorantData', 'vetoTeamsInfo'];
const ALL = [...BOTH, ...DOWN];
const CHUNK = 256 * 1024;                // caractères par morceau (≤ 768 ko en UTF-8)
const MAX_MESSAGE = 64 * 1024 * 1024;
const CATEGORIES = Object.fromEntries(require(path.join(ROOT, 'package.json')).nodecg.assetCategories
	.map((c) => [c.name, c.allowedTypes.map((t) => t.toLowerCase())]));
const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function equal(a, b) {
	if (a === b) return true;
	if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i]));
	if (!isObj(a) || !isObj(b)) return false;
	const ka = Object.keys(a);
	return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
// Opérations qui transforment a en b. Tableau de longueur différente : remplacé en entier.
function diff(a, b, p = [], out = []) {
	if (equal(a, b)) return out;
	if (isObj(a) && isObj(b)) {
		for (const k of Object.keys(a)) if (!Object.hasOwn(b, k)) out.push({ p: [...p, k] });
		for (const k of Object.keys(b)) diff(a[k], b[k], [...p, k], out);
	} else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
		b.forEach((x, i) => diff(a[i], x, [...p, i], out));
	} else out.push(b === undefined ? { p } : { p, v: b });
	return out;
}
// Applique les opérations sur une copie → { value }, ou null si un chemin n'existe plus (valeurs trop différentes : resynchroniser)
function patch(value, ops) {
	let root = clone(value);
	for (const op of ops) {
		const p = op && op.p;
		if (!Array.isArray(p) || p.some((k) => BAD_KEY.has(k))) return null;
		if (!p.length) { root = clone(op.v); continue; }
		let o = root;
		for (const k of p.slice(0, -1)) o = o && typeof o === 'object' ? o[k] : undefined;
		if (!o || typeof o !== 'object') return null;
		const k = p[p.length - 1];
		if (op.v === undefined) delete o[k]; else o[k] = clone(op.v);
	}
	return { value: root };
}
// Rien ne change à l'antenne à la reconnexion : un élément affiché ici garde tout son contenu,
// un élément masqué ici le reste (son contenu suit la régie en ligne)
function keepOnAir(next, local) {
	if (!isObj(next) || !isObj(local)) return next;
	if (local.visible === true) return clone(local);
	if (Object.hasOwn(local, 'visible')) next.visible = local.visible;
	for (const k of Object.keys(local)) if (k !== 'visible' && isObj(next[k])) next[k] = keepOnAir(next[k], local[k]);
	return next;
}

// ---------- Fichiers ----------
const newToken = () => crypto.randomBytes(24).toString('base64url');
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const writeSecret = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, { mode: 0o600 }); };
function savedToken() {
	try { const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); if (t.length >= 16) return t; } catch { /* pas encore créé */ }
	return null;
}
function createToken() { const t = newToken(); writeSecret(TOKEN_FILE, t + '\n'); return t; }
const sameToken = (given, token) => {
	const a = Buffer.from(String(given || '')), b = Buffer.from(token);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
};
// « regie.mondomaine.fr », « https://regie.mondomaine.fr/ » → https://regie.mondomaine.fr
function normalizeUrl(text) {
	let s = String(text || '').trim();
	if (!s) throw new Error('Adresse de la régie en ligne manquante.');
	if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
	let u;
	try { u = new URL(s); } catch { throw new Error(`Adresse invalide : « ${text} ».`); }
	return u.origin;
}

// ---------- Assets (logos, photos) : liste avec empreinte, recalculée seulement si le fichier a changé ----------
const validAsset = (category, base) => Object.hasOwn(CATEGORIES, category) && typeof base === 'string' && base === path.basename(base)
	&& !base.startsWith('.') && CATEGORIES[category].includes(path.extname(base).slice(1).toLowerCase());
const hashes = new Map();
async function assetList() {
	const out = [];
	for (const category of Object.keys(CATEGORIES)) {
		let names;
		try { names = await fs.promises.readdir(path.join(ASSETS, category)); } catch { continue; }
		for (const base of names) {
			if (!validAsset(category, base)) continue;
			const file = path.join(ASSETS, category, base);
			let st;
			try { st = await fs.promises.stat(file); } catch { continue; }
			if (!st.isFile()) continue;
			let h = hashes.get(file);
			if (!h || h.mtimeMs !== st.mtimeMs || h.size !== st.size) {
				h = { mtimeMs: st.mtimeMs, size: st.size, sum: crypto.createHash('sha1').update(await fs.promises.readFile(file)).digest('hex') };
				hashes.set(file, h);
			}
			out.push({ category, base, sum: h.sum });
		}
	}
	return out;
}

module.exports = function (nodecg, listen, backup) {
	const reps = Object.fromEntries(ALL.map((n) => [n, nodecg.Replicant(n)]));
	const status = nodecg.Replicant('syncStatus', { defaultValue: {}, persistent: false });
	const nsp = nodecg.getSocketIOServer().server.of(NSP);

	// ---------- Jeton du relais ----------
	const tokenFromEnv = !!process.env.SYNC_TOKEN;
	let token = process.env.SYNC_TOKEN || savedToken() || createToken();
	if (tokenFromEnv && token.length < 16) nodecg.log.warn('SYNC_TOKEN est très court : choisis au moins 16 caractères aléatoires.');

	const hub = { base: {}, since: new Map() };     // base : dernière valeur envoyée aux régies reliées
	const client = { socket: null, url: '', base: {}, seq: 0, unacked: {}, connected: false, everConnected: false, since: 0, error: '', assets: null };
	for (const n of ALL) hub.base[n] = clone(reps[n].value);

	function publish() {
		status.value = client.socket
			? { role: 'client', url: client.url, connected: client.connected, since: client.since, error: client.error, assets: client.assets }
			: { role: 'hub', clients: [...hub.since].map(([id, s]) => ({ id, ...s })) };
	}

	// ---------- Changements locaux ----------
	for (const n of ALL) {
		reps[n].on('change', (raw) => {
			const v = clone(raw);
			// Relais : envoi aux régies reliées
			if (!nsp.sockets.size) hub.base[n] = v;
			else {
				const ops = diff(hub.base[n], v);
				if (ops.length) { hub.base[n] = v; nsp.emit('m', JSON.stringify(['ops', { name: n, ops }])); }
			}
			// Relié : envoi à la régie en ligne (hors connexion, rattrapé à la reconnexion : diff entre base et valeur locale)
			if (!client.connected || DOWN.includes(n)) return;
			const ops = diff(client.base[n], v);
			if (ops.length) pushUp(n, ops, v);
		});
	}
	// Valeur reçue : écrite seulement si elle change quelque chose (le changement qu'elle provoque ne repart pas : base à jour)
	const applyLocal = (n, value) => { if (!equal(value, clone(reps[n].value))) reps[n].value = value; };

	// ---------- Relais (régie en ligne) ----------
	const emitTo = (socket, type, data) => socket.emit('m', JSON.stringify([type, data]));
	nsp.use((socket, next) => {
		if (client.socket) return next(new Error('Cette régie est elle-même reliée à une régie en ligne : elle n\'accepte pas d\'autre régie.'));
		if (sameToken((socket.handshake.auth || {}).token, token)) return next();
		nodecg.log.warn(`Synchronisation : jeton refusé (${socket.handshake.address})`);
		next(new Error('Jeton de synchronisation refusé : copie celui du panneau Données de la régie en ligne.'));
	});
	nsp.on('connection', (socket) => {
		const where = socket.handshake.address;
		nodecg.log.info(`Synchronisation : régie reliée (${where})`);
		hub.since.set(socket.id, { address: where, since: Date.now() });
		publish();
		// Valeurs à jour avant l'instantané (un changement pas encore diffusé partirait sinon en double)
		for (const n of ALL) {
			const v = clone(reps[n].value), ops = diff(hub.base[n], v);
			if (ops.length) { hub.base[n] = v; socket.broadcast.emit('m', JSON.stringify(['ops', { name: n, ops }])); }
		}
		emitTo(socket, 'snapshot', { values: hub.base });

		let parts = [], size = 0;
		socket.on('part', (s) => {
			if (typeof s !== 'string') return;
			size += s.length;
			if (size > MAX_MESSAGE) { nodecg.log.warn('Synchronisation : message trop gros, régie déconnectée'); socket.disconnect(true); return; }
			parts.push(s);
		});
		socket.on('m', (s) => {
			if (s === null) { s = parts.join(''); parts = []; size = 0; }
			let msg;
			try { msg = JSON.parse(s); } catch { return; }
			const [type, data] = Array.isArray(msg) ? msg : [];
			const name = data && data.name;
			if (type === 'ops' && BOTH.includes(name) && Array.isArray(data.ops)) receiveUp(socket, name, data.ops, data.seq);
			else if (type === 'want' && ALL.includes(name)) emitTo(socket, 'full', { name, value: hub.base[name] });
		});
		socket.on('assets:list', (ack) => {
			if (typeof ack === 'function') assetList().then(ack, () => ack([]));
		});
		socket.on('assets:get', (category, base, ack) => {
			if (typeof ack !== 'function') return;
			if (!validAsset(category, base)) return ack(null);
			fs.promises.readFile(path.join(ASSETS, category, base)).then(ack, () => ack(null));
		});
		socket.on('disconnect', (reason) => {
			nodecg.log.info(`Synchronisation : régie déconnectée (${where}, ${reason})`);
			hub.since.delete(socket.id);
			publish();
		});
	});
	// Opérations d'une régie reliée : appliquées ici, renvoyées aux autres, puis confirmées avec la valeur qui fait foi
	function receiveUp(socket, name, ops, seq) {
		const r = reps[name];
		const next = patch(r.value, ops);
		if (next) {
			const b = patch(hub.base[name], ops);
			hub.base[name] = b ? b.value : clone(next.value);
			applyLocal(name, next.value);
			socket.broadcast.emit('m', JSON.stringify(['ops', { name, ops }]));
		} else nodecg.log.warn(`Synchronisation : modification de « ${name} » ignorée (valeurs trop différentes, resynchronisée)`);
		// Après les réactions du serveur à ce changement (match.js, live.js…) : la valeur confirmée les contient
		setImmediate(() => emitTo(socket, 'ack', { name, seq, value: hub.base[name] }));
	}
	// Logo ou photo ajouté, remplacé ou supprimé ici : les régies reliées refont leur copie
	let assetsTimer = null;
	for (const category of Object.keys(CATEGORIES)) {
		nodecg.Replicant(`assets:${category}`).on('change', () => {
			if (!nsp.sockets.size) return;
			clearTimeout(assetsTimer);
			assetsTimer = setTimeout(() => nsp.emit('assets:changed'), 500);
		});
	}

	// ---------- Relié (régie sur place) ----------
	function sendUp(type, data) {
		const s = JSON.stringify([type, data]);
		if (s.length <= CHUNK) return client.socket.emit('m', s);
		for (let i = 0; i < s.length; i += CHUNK) client.socket.emit('part', s.slice(i, i + CHUNK));
		client.socket.emit('m', null);
	}
	function pushUp(n, ops, next) {
		client.base[n] = next;
		const seq = ++client.seq;
		(client.unacked[n] ||= []).push({ seq, ops });
		sendUp('ops', { name: n, ops, seq });
	}
	// Sauvegarde avant que l'instantané ne change des données d'ici (régie en ligne vidée, restaurée…) :
	// toujours au premier contact, puis au plus une fois toutes les 10 minutes (réseau instable)
	let lastBackup = 0;
	function backupBefore(values, first) {
		if (!first && Date.now() - lastBackup < 10 * 60 * 1000) return;
		if (!NAMES.some((n) => Object.hasOwn(values, n) && !OVERLAYS.includes(n) && n !== 'streamScene' && !equal(values[n], clone(reps[n].value)))) return;
		try {
			const file = backup.snapshot('avant-synchro');
			lastBackup = Date.now();
			nodecg.log.info(`Synchronisation : données de la régie en ligne reçues, sauvegarde des données d'ici : ${backup.relative(file)}`);
		} catch (e) { nodecg.log.warn('Synchronisation : sauvegarde impossible avant la synchro :', e.message); }
	}
	function onSnapshot(values) {
		const first = !client.everConnected;
		const unacked = client.unacked;
		client.unacked = {};
		backupBefore(values, first);
		for (const n of ALL) {
			if (!Object.hasOwn(values, n)) continue;   // régie en ligne d'une autre version
			// base : dernière valeur connue d'en ligne (inchangée pendant la coupure)
			const remote = values[n], local = clone(reps[n].value), old = client.base[n];
			client.base[n] = remote;
			if (DOWN.includes(n)) { applyLocal(n, remote); continue; }
			// La dernière transition d'en ligne n'est jamais rejouée ici
			if (n === 'transition') continue;
			let next = remote;
			if (!first) {
				// Modifications d'ici pendant la coupure (envoyées sans réponse + faites hors connexion), rejouées sur la valeur d'en ligne
				const ops = [...(unacked[n] || []).flatMap((x) => x.ops), ...diff(old, local)];
				const merged = ops.length && patch(remote, ops);
				if (merged) next = merged.value;
			}
			if (n === 'streamScene') next = local;
			else if (OVERLAYS.includes(n)) next = keepOnAir(clone(next), local);
			const ops = diff(remote, next);
			if (ops.length) pushUp(n, ops, clone(next));
			applyLocal(n, next);
		}
		client.everConnected = true;
	}
	function onDown(msg) {
		const [type, data] = Array.isArray(msg) ? msg : [];
		if (type === 'snapshot') return onSnapshot((data && data.values) || {});
		const name = data && data.name;
		if (!ALL.includes(name)) return;
		if (type === 'ops') {
			const b = patch(client.base[name], data.ops || []), l = patch(reps[name].value, data.ops || []);
			if (!b || !l) return sendUp('want', { name });
			client.base[name] = b.value;
			applyLocal(name, l.value);
		} else if (type === 'ack') {
			const rest = (client.unacked[name] || []).filter((x) => x.seq > data.seq);
			client.unacked[name] = rest;
			if (rest.length) return;   // un envoi plus récent est en route : sa propre réponse fera foi
			client.base[name] = data.value;
			applyLocal(name, data.value);
		} else if (type === 'full') {
			client.base[name] = data.value;
			if (!(client.unacked[name] || []).length) applyLocal(name, data.value);
		}
	}

	function startClient(url, tok) {
		stopClient();
		nsp.disconnectSockets(true);   // une régie reliée n'en relaie pas d'autre
		client.url = url;
		client.error = '';
		const socket = connectTo(url + NSP, { auth: { token: tok }, transports: ['websocket'], reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
		client.socket = socket;
		socket.on('connect', () => {
			nodecg.log.info(`Synchronisation : reliée à ${url}`);
			client.error = '';
			client.since = Date.now();
		});
		socket.on('m', (s) => {
			let msg;
			try { msg = JSON.parse(s); } catch { return; }
			try {
				onDown(msg);
				if (msg[0] === 'snapshot') { client.connected = true; publish(); syncAssets(); }
			} catch (e) { nodecg.log.error('Synchronisation : message reçu en erreur :', e.stack || e.message); }
		});
		socket.on('assets:changed', () => syncAssets());
		socket.on('disconnect', (reason) => {
			if (client.socket !== socket) return;
			nodecg.log.warn(`Synchronisation : coupée (${reason}), reconnexion automatique`);
			client.connected = false;
			publish();
		});
		socket.on('connect_error', (e) => {
			if (client.socket !== socket) return;
			client.error = e.message;
			// Refus du relais (jeton) : pas de nouvelle tentative automatique ; panne réseau : socket.io réessaie seul
			if (!socket.active) nodecg.log.warn(`Synchronisation : ${e.message}`);
			publish();
		});
		publish();
	}
	function stopClient() {
		if (!client.socket) return;
		const socket = client.socket;
		client.socket = null;
		client.connected = false;
		client.everConnected = false;
		client.unacked = {};
		socket.removeAllListeners();
		socket.disconnect();
		publish();
	}

	// Copie des logos et photos : ce qui manque ou a changé en ligne est téléchargé ; un fichier supprimé en ligne
	// l'est aussi ici, seulement s'il n'a pas été modifié ici depuis sa copie. Rien ne part d'ici vers la régie en ligne.
	let assetsRun = null, assetsAgain = false;
	function syncAssets() {
		if (assetsRun) { assetsAgain = true; return; }
		assetsRun = (async () => {
			do { assetsAgain = false; await mirrorAssets(); } while (assetsAgain && client.connected);
		})().catch((e) => {
			client.assets = { ...(client.assets || {}), error: e.message, at: Date.now() };
			nodecg.log.warn('Synchronisation : copie des logos et photos interrompue :', e.message);
		}).finally(() => { assetsRun = null; publish(); });
	}
	async function mirrorAssets() {
		const socket = client.socket;
		if (!socket || !client.connected) return;
		const remote = await socket.timeout(30000).emitWithAck('assets:list');
		const local = new Map((await assetList()).map((f) => [f.category + '/' + f.base, f.sum]));
		const before = new Map(Object.entries(readJson(MIRROR_FILE) || {}));
		const now = new Map();
		let copied = 0, failed = 0;
		for (const f of Array.isArray(remote) ? remote : []) {
			if (!f || !validAsset(f.category, f.base) || typeof f.sum !== 'string') continue;
			const key = f.category + '/' + f.base;
			now.set(key, f.sum);
			if (local.get(key) === f.sum) continue;
			const data = await socket.timeout(120000).emitWithAck('assets:get', f.category, f.base);
			if (!Buffer.isBuffer(data)) { failed++; continue; }
			const file = path.join(ASSETS, f.category, f.base);
			await fs.promises.mkdir(path.dirname(file), { recursive: true });
			// Fichier temporaire hors des types surveillés par NodeCG, puis renommé : jamais d'image à moitié écrite
			await fs.promises.writeFile(file + '.part', data);
			await fs.promises.rename(file + '.part', file);
			copied++;
		}
		let removed = 0;
		for (const [key, sum] of before) {
			if (now.has(key) || local.get(key) !== sum) continue;
			const [category, base] = key.split('/');
			if (!validAsset(category, base)) continue;
			try { await fs.promises.unlink(path.join(ASSETS, category, base)); removed++; } catch { /* déjà supprimé */ }
		}
		writeSecret(MIRROR_FILE, JSON.stringify(Object.fromEntries(now)));
		if (copied || removed || failed) nodecg.log.info(`Synchronisation : logos et photos, ${copied} copié(s), ${removed} supprimé(s), ${failed} en échec`);
		client.assets = { files: now.size, copied, removed, failed, at: Date.now() };
	}

	// ---------- Réglage (variables d'environnement, sinon panneau Données) ----------
	const urlFromEnv = !!process.env.SYNC_URL;
	if (urlFromEnv) {
		if (!process.env.SYNC_TOKEN) nodecg.log.error('SYNC_URL est fixée sans SYNC_TOKEN : la synchronisation ne peut pas démarrer.');
		else startClient(normalizeUrl(process.env.SYNC_URL), process.env.SYNC_TOKEN);
	} else {
		const cfg = readJson(CONFIG_FILE);
		if (cfg && cfg.url && cfg.token) startClient(normalizeUrl(cfg.url), cfg.token);
	}
	if (!client.socket) publish();

	listen('sync:info', () => ({ token, tokenFromEnv, url: client.url && client.socket ? client.url : '', urlFromEnv }));
	listen('sync:connect', ({ url, token: tok }) => {
		if (urlFromEnv) throw new Error('La régie en ligne est fixée par la variable SYNC_URL.');
		url = normalizeUrl(url);
		tok = String(tok || '').trim();
		if (tok.length < 16) throw new Error('Jeton manquant ou trop court : copie celui du panneau Données de la régie en ligne.');
		writeSecret(CONFIG_FILE, JSON.stringify({ url, token: tok }, null, '\t') + '\n');
		startClient(url, tok);
		return { url };
	});
	listen('sync:disconnect', () => {
		if (urlFromEnv) throw new Error('La régie en ligne est fixée par la variable SYNC_URL.');
		try { fs.unlinkSync(CONFIG_FILE); } catch { /* déjà absent */ }
		stopClient();
		return { stopped: true };
	});
	listen('sync:newToken', () => {
		if (tokenFromEnv) throw new Error('Le jeton est fixé par la variable SYNC_TOKEN : change-la chez ton hébergeur puis relance.');
		token = createToken();
		nsp.disconnectSockets(true);
		return { token };
	});
};
