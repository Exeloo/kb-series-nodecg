// ESLint : erreurs réelles uniquement (variable inconnue, code mort…), aucune règle de style.
// Lancer : npm run lint
const js = require('@eslint/js');
const html = require('eslint-plugin-html');
const globals = require('globals');

// API injectée par NodeCG + objets exposés par shared/*.js
const kb = Object.fromEntries(
	['nodecg', 'NodeCG', 'KB', 'KBD', 'KBO', 'KBI', 'KBM', 'KBP', 'KBB', 'KBMatch', 'KBScenes', 'KBDefaults', 'KBLT', 'LIVE', 'KBOList'].map((n) => [n, 'readonly']),
);

module.exports = [
	{ ignores: ['node_modules/**', 'db/**', 'assets/**', 'exports/**', 'shots/**', 'logs/**', 'Medias/**'] },
	js.configs.recommended,
	{
		// Serveur et outils : Node, CommonJS
		files: ['**/*.js'],
		languageOptions: { ecmaVersion: 2025, sourceType: 'commonjs', globals: { ...globals.node } },
	},
	{
		// Outils de capture : leur code exécuté dans la page (page.evaluate) utilise window, document…
		files: ['tools/*.js'],
		languageOptions: { globals: { ...globals.node, ...globals.browser } },
	},
	{
		// Modules partagés navigateur + Node (UMD)
		files: ['shared/**/*.js', 'dashboard/**/*.js'],
		languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...globals.node, ...kb } },
	},
	{
		// Scripts en ligne des panneaux et des overlays
		files: ['dashboard/**/*.html', 'graphics/**/*.html'],
		plugins: { html },
		languageOptions: { ecmaVersion: 2025, sourceType: 'script', globals: { ...globals.browser, ...kb } },
	},
	{
		// Extension Chrome (make-icons.js tourne sous Node)
		files: ['tools/tracker-extension/**/*.js', 'tools/tracker-extension/**/*.html'],
		ignores: ['tools/tracker-extension/make-icons.js'],
		plugins: { html },
		languageOptions: { sourceType: 'script', globals: { ...globals.browser, chrome: 'readonly' } },
	},
	{
		rules: {
			'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
			'no-empty': ['error', { allowEmptyCatch: true }],
			'no-redeclare': ['error', { builtinGlobals: false }],
		},
	},
];
