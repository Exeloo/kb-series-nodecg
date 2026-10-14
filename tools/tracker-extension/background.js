// Arrière-plan de l'extension « KB SERIES · Import tracker.gg → NodeCG » : service worker sous Chrome,
// script d'arrière-plan sous Firefox (manifest.json déclare les deux, chaque navigateur prend le sien).
//
// Pourquoi : tracker.gg (Cloudflare) refuse les requêtes du serveur NodeCG (403). Depuis le navigateur de
// l'utilisateur, sur une page tracker.gg, l'API répond. On ouvre donc le profil dans un onglet en arrière-plan,
// on exécute le fetch de l'API DANS la page (world MAIN, cookies tracker.gg), puis on POST le JSON à NodeCG.
//
// Les imports passent dans une file d'attente : un seul onglet tracker.gg à la fois.

const API = 'https://api.tracker.gg/api/v2/valorant/standard/profile/riot/';
const profileUrl = (riotId) => `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riotId)}/overview`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LOAD_TIMEOUT = 30000;       // chargement de la page tracker.gg
const CHALLENGE_TIMEOUT = 180000; // temps laissé à l'utilisateur pour passer la vérification Cloudflare

// ---------- Journal (popup) ----------
const state = { running: null, queued: 0, log: [] };
async function saveState() {
	try { await chrome.storage.session.set({ state }); } catch { /* ignore */ }
}
function addLog(entry) {
	state.log.unshift({ ...entry, at: Date.now() });
	state.log = state.log.slice(0, 15);
	saveState();
}

// ---------- File d'attente ----------
let chain = Promise.resolve();

chrome.runtime.onConnect.addListener((port) => {
	if (port.name !== 'kb-import') return;
	let alive = true;
	port.onDisconnect.addListener(() => { alive = false; });
	const send = (m) => { if (alive) { try { port.postMessage(m); } catch { alive = false; } } };
	// L'envoi à NodeCG est fait par la page de la régie elle-même (même origine, avec la session de connexion) :
	// marche en local (http://…:9090) comme sur un domaine en HTTPS protégé par mot de passe.
	let postWaiter = null;
	port.onMessage.addListener((m) => { if (m && m.type === 'posted' && postWaiter) { const w = postWaiter; postWaiter = null; w(m); } });
	const postViaPage = (text, playlist) => new Promise((resolve, reject) => {
		const t = setTimeout(() => { postWaiter = null; reject(new Error('La régie n’a pas répondu (page fermée ?)')); }, 30000);
		postWaiter = (m) => { clearTimeout(t); resolve(m); };
		send({ type: 'post', text, playlist });
	});

	port.onMessage.addListener((msg) => {
		if (!msg || msg.type !== 'import') return;
		// Origine de la régie = celle de la frame qui a demandé l'import (jamais une valeur fournie par la page)
		let origin;
		try { origin = new URL(port.sender.url).origin; } catch { origin = null; }
		const riotId = String(msg.riotId || '').trim();
		if (!origin || !/^.+#.+$/.test(riotId)) {
			send({ type: 'result', ok: false, riotId, message: 'Riot ID invalide (format attendu : Pseudo#TAG).' });
			return;
		}
		try { chrome.storage.local.set({ lastOrigin: origin }); } catch { /* ignore */ }

		const ahead = state.queued + (state.running ? 1 : 0);
		state.queued++;
		saveState();
		if (ahead) send({ type: 'status', state: 'queued', message: `En file d'attente (${ahead} import${ahead > 1 ? 's' : ''} avant).` });

		const job = async () => {
			state.queued--;
			state.running = riotId;
			saveState();
			try {
				return await importOne(riotId, msg.playlist || 'competitive', origin, send, postViaPage);
			} finally {
				state.running = null;
				saveState();
			}
		};
		const p = chain.then(job, job);
		chain = p.catch(() => {});
		p.then((res) => {
			addLog({ riotId: res.riotId || riotId, ok: true, message: res.message });
			send({ type: 'result', ok: true, riotId: res.riotId || riotId, message: res.message });
		}).catch((e) => {
			const message = String((e && e.message) || e);
			addLog({ riotId, ok: false, message });
			send({ type: 'result', ok: false, riotId, message });
		});
	});
});

// ---------- Import d'un joueur ----------
// Firefox peut installer l'extension sans l'accès à tracker.gg (accordé ensuite par l'utilisateur) : on le vérifie avant d'ouvrir l'onglet
const TRACKER_ORIGINS = { origins: ['https://tracker.gg/*', 'https://api.tracker.gg/*'] };
async function hasTrackerAccess() {
	try { return await chrome.permissions.contains(TRACKER_ORIGINS); } catch { return true; }
}

async function importOne(riotId, playlist, origin, send, postViaPage) {
	if (!(await hasTrackerAccess())) {
		throw new Error('L\'extension n\'a pas l\'autorisation d\'accéder à tracker.gg : clique sur son icône dans la barre d\'outils, puis sur « Autoriser l\'accès ».');
	}
	send({ type: 'status', state: 'opening', message: `Ouverture du profil tracker.gg de ${riotId}…` });
	const tab = await chrome.tabs.create({ url: profileUrl(riotId), active: false });
	let keepTab = false;
	try {
		await waitForLoad(tab.id, LOAD_TIMEOUT);
		send({ type: 'status', state: 'fetching', message: 'Récupération des stats sur tracker.gg…' });
		let r = await runInTab(tab.id, riotId);

		if (r.challenge) {
			// Vérification anti-robot Cloudflare : on montre l'onglet pour que l'utilisateur la passe
			try {
				await chrome.tabs.update(tab.id, { active: true });
				const t = await chrome.tabs.get(tab.id);
				await chrome.windows.update(t.windowId, { focused: true });
			} catch { /* onglet fermé ? */ }
			send({ type: 'status', state: 'challenge', message: 'tracker.gg demande une vérification anti-robot : valide-la dans l\'onglet ouvert, l\'import reprendra tout seul.' });
			const until = Date.now() + CHALLENGE_TIMEOUT;
			while (r.challenge && Date.now() < until) {
				await sleep(2500);
				if (!(await tabExists(tab.id))) throw new Error('Onglet tracker.gg fermé avant la fin de la vérification.');
				r = await runInTab(tab.id, riotId);
			}
			if (r.challenge) {
				keepTab = true;
				throw new Error('Vérification tracker.gg non validée à temps : passe-la dans l\'onglet resté ouvert puis relance l\'import.');
			}
		}

		if (!r.ok) throw new Error(explain(r));

		send({ type: 'status', state: 'sending', message: 'Envoi à NodeCG…' });
		const j = await postViaPage(r.text, playlist);
		if (!j.ok) throw new Error(j.error || `Import refusé par NodeCG (${origin})`);
		return { riotId: j.riotId || riotId, message: `✔ ${j.riotId || riotId} importé depuis tracker.gg` };
	} finally {
		if (!keepTab) { try { await chrome.tabs.remove(tab.id); } catch { /* déjà fermé */ } }
	}
}

/** Message lisible pour une réponse API en erreur */
function explain(r) {
	let apiMsg = '';
	try { const j = JSON.parse(r.text || ''); apiMsg = (j.errors && j.errors[0] && j.errors[0].message) || ''; } catch { /* pas du JSON */ }
	const s = r.status;
	if (s === 404) return `Profil introuvable sur tracker.gg (vérifie le Riot ID, majuscules/espaces compris).${apiMsg ? ' ' + apiMsg : ''}`;
	if (s === 451 || /private/i.test(apiMsg)) return 'Profil privé : le joueur doit se connecter sur tracker.gg (Riot) pour rendre ses stats publiques.';
	if (s === 429) return 'tracker.gg limite les requêtes : réessaie dans une minute.';
	if (s === 403) return 'Accès refusé par tracker.gg (403). Ouvre tracker.gg dans un onglet, passe la vérification éventuelle, puis réessaie.';
	// Requête bloquée avant d'avoir une réponse lisible (Cloudflare renvoie un 403 sans en-têtes CORS) : même cause qu'un 403
	if (!s && /NetworkError|Failed to fetch|Load failed/i.test(r.error || '')) return 'tracker.gg a bloqué la requête (vérification anti-robot ?). Ouvre tracker.gg dans un onglet de ce navigateur, passe la vérification éventuelle, puis réessaie.';
	if (!s) return `Requête tracker.gg impossible : ${r.error || 'erreur réseau'}`;
	return `tracker.gg a répondu ${s}${apiMsg ? ' : ' + apiMsg : ''}`;
}

async function tabExists(tabId) {
	try { await chrome.tabs.get(tabId); return true; } catch { return false; }
}

/**
 * Attend que la page tracker.gg de l'onglet soit chargée (ou le délai max, sans erreur : on tente quand même le fetch).
 * Firefox ouvre d'abord l'onglet sur about:blank, déjà « complete » : on attend donc aussi que l'adresse soit celle de tracker.gg.
 */
function waitForLoad(tabId, timeout) {
	return new Promise((resolve) => {
		let done = false;
		const loaded = (t) => t && t.status === 'complete' && /^https:\/\/tracker\.gg\//.test(t.url || '');
		const finish = () => { if (done) return; done = true; chrome.tabs.onUpdated.removeListener(onUpd); clearTimeout(timer); resolve(); };
		const onUpd = (id, info, tab) => { if (id === tabId && loaded(tab)) finish(); };
		const timer = setTimeout(finish, timeout);
		chrome.tabs.onUpdated.addListener(onUpd);
		chrome.tabs.get(tabId).then((t) => { if (loaded(t)) finish(); }).catch(finish);
	});
}

/** Exécute le fetch de l'API dans la page tracker.gg (cookies + contexte du site) */
async function runInTab(tabId, riotId) {
	try {
		const [res] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: pageFetch, args: [API, riotId] });
		return (res && res.result) || { ok: false, status: 0, error: 'aucun résultat' };
	} catch (e) {
		// Page en cours de navigation (ex. après la vérification Cloudflare) : on retentera
		return { ok: false, status: 0, challenge: /frame|navigat|removed|error page|cannot access/i.test(e.message), error: e.message };
	}
}

// ⚠ Sérialisée et exécutée dans la page : doit rester autonome (aucune variable extérieure)
async function pageFetch(api, riotId) {
	const challengeTitle = /just a moment|un instant|attention required|verify you are human|vérifi/i;
	if (challengeTitle.test(document.title) || document.querySelector('#challenge-form, #challenge-running, #challenge-stage, #cf-challenge-running')) {
		return { challenge: true };
	}
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 30000);
	try {
		const r = await fetch(api + encodeURIComponent(riotId) + '?source=web', {
			credentials: 'include', headers: { Accept: 'application/json' }, signal: ctrl.signal,
		});
		const text = await r.text();
		if (r.status === 403 && /<html/i.test(text.slice(0, 500))) return { challenge: true, status: 403 };
		return { ok: r.ok, status: r.status, text: r.ok ? text : text.slice(0, 4000) };
	} catch (e) {
		return { ok: false, status: 0, error: String((e && e.message) || e) };
	} finally {
		clearTimeout(t);
	}
}
