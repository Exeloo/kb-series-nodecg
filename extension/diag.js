// Diagnostic du direct : mesure, dans chaque page d'overlay ouverte (vMix, OBS, navigateur…), le temps entre une commande
// de la régie et sa prise en compte, pour savoir si un retard vient du réseau, du serveur ou du navigateur qui affiche l'overlay.
//   diagPing (non persistant) : { run, id, t } — écrit ici à chaque mesure, comme une commande AFFICHER / MASQUER
//   Chaque page graphique (shared/kb.js) répond par le message 'diag:pong' :
//     stage 'recv'  dès que le changement arrive (aller-retour réseau serveur → page → serveur)
//     stage 'frame' avec raf (ms jusqu'à la prochaine image affichée, null si aucune en 3 s) et tmo (ms jusqu'à un setTimeout 0)
// Message 'diag:run' → { sent, clients: [{ client, ua, pages: [{ page, got, net, raf, tmo, vis, transport, framed }] }] }
const PINGS = 5;
const GAP_MS = 400;
const SETTLE_MS = 3500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const max = (a) => (a.length ? Math.max(...a) : null);

module.exports = function (nodecg, listen) {
	const ping = nodecg.Replicant('diagPing', { defaultValue: { run: null, id: null, t: 0 }, persistent: false });
	let run = null; // { id, pages: Map(client|page → mesures) }

	listen('diag:pong', (d) => {
		if (!run || !d || d.run !== run.id) return;
		const key = `${d.client}|${d.page}`;
		let e = run.pages.get(key);
		if (!e) run.pages.set(key, (e = { client: String(d.client || '?'), page: String(d.page || '?'), ua: String(d.ua || '').slice(0, 200), ids: new Set(), net: [], raf: [], tmo: [], rafMissed: 0 }));
		e.vis = d.vis; e.transport = d.transport; e.framed = !!d.framed;
		if (d.stage === 'recv' && run.sentAt.has(d.id)) { e.ids.add(d.id); e.net.push(Date.now() - run.sentAt.get(d.id)); }
		if (d.stage === 'frame') {
			if (typeof d.raf === 'number') e.raf.push(d.raf); else e.rafMissed++;
			if (typeof d.tmo === 'number') e.tmo.push(d.tmo);
		}
	});

	listen('diag:run', async () => {
		if (run) throw new Error('Un test est déjà en cours');
		const id = Date.now().toString(36);
		run = { id, pages: new Map(), sentAt: new Map() };
		try {
			for (let i = 0; i < PINGS; i++) {
				const pid = `${id}-${i}`;
				run.sentAt.set(pid, Date.now());
				ping.value = { run: id, id: pid, t: Date.now() };
				await sleep(GAP_MS);
			}
			await sleep(SETTLE_MS);
			const clients = new Map();
			for (const e of run.pages.values()) {
				if (!clients.has(e.client)) clients.set(e.client, { client: e.client, ua: e.ua, pages: [] });
				clients.get(e.client).pages.push({
					page: e.page, got: e.ids.size, net: median(e.net), netMax: max(e.net), raf: median(e.raf), rafMax: max(e.raf), rafMissed: e.rafMissed,
					tmo: median(e.tmo), vis: e.vis, transport: e.transport, framed: e.framed,
				});
			}
			const out = { sent: PINGS, clients: [...clients.values()] };
			nodecg.log.info(`Diagnostic : ${out.clients.length} navigateur(s), ${run.pages.size} page(s) d'overlay ont répondu`);
			return out;
		} finally {
			run = null;
		}
	});
};
