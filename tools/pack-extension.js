// Empaquette l'extension tracker.gg (tools/tracker-extension) en un fichier .zip prêt à envoyer sur addons.mozilla.org
// pour la faire signer (Firefox n'installe durablement que des extensions signées), ou à installer dans Chrome / Edge.
// Usage : npm run pack:extension   → exports/kb-tracker-import-<version>.zip
// Zip écrit à la main (zlib de Node) : aucune dépendance.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const src = path.join(__dirname, 'tracker-extension');
const SKIP = new Set(['make-icons.js', 'README.md']); // outil de développement et guide : inutiles dans l'extension
const { version } = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
const out = path.join(root, 'exports', `kb-tracker-import-${version}.zip`);

// Date des fichiers dans le zip (format DOS) : fixe, pour qu'un même contenu donne toujours le même fichier
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 1er janvier 2026

const files = [];
(function walk(dir) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) walk(full);
		else if (!SKIP.has(e.name)) files.push(full);
	}
})(src);

const local = [], central = [];
let offset = 0;
for (const full of files) {
	const name = Buffer.from(path.relative(src, full).split(path.sep).join('/'));
	const data = fs.readFileSync(full);
	const packed = zlib.deflateRawSync(data, { level: 9 });
	const crc = zlib.crc32(data);
	const head = Buffer.alloc(30);
	head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
	head.writeUInt16LE(0, 10); head.writeUInt16LE(DOS_DATE, 12); head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22);
	head.writeUInt16LE(name.length, 26); head.writeUInt16LE(0, 28);
	local.push(head, name, packed);
	const dir = Buffer.alloc(46);
	dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x0800, 8); dir.writeUInt16LE(8, 10);
	dir.writeUInt16LE(0, 12); dir.writeUInt16LE(DOS_DATE, 14); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(data.length, 24);
	dir.writeUInt16LE(name.length, 28); dir.writeUInt32LE(offset, 42);
	central.push(dir, name);
	offset += head.length + name.length + packed.length;
}
const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([...local, centralBuf, end]));
console.log(`${files.length} fichiers → ${path.relative(root, out)}`);
