import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

const root = import.meta.dirname;

/** URL paths of the two locale pages. */
const PAGES: Record<string, 'en' | 'fr'> = {
	'/': 'en',
	'/index.html': 'en',
	'/fr': 'fr',
	'/fr/': 'fr',
	'/fr/index.html': 'fr',
};

/** Folders whose changes require a full page reload (data and server-side rendering). */
const RELOAD_ON_CHANGE = [join(root, 'data'), join(root, 'src', 'build')];

/**
 * Serves a locale page rendered from the current data, or hands the request over to Vite.
 *
 * @param server Vite dev server.
 * @param req Incoming request.
 * @param res Response to write.
 * @param next Passes the request to the next middleware.
 */
async function servePage(
	server: ViteDevServer,
	req: IncomingMessage,
	res: ServerResponse,
	next: () => void,
) {
	const path = (req.url ?? '/').split('?')[0] ?? '/';
	const locale = PAGES[path];
	if (!locale) return next();

	const pages = (await server.ssrLoadModule(
		'/src/build/pages.ts',
	)) as typeof import('./src/build/pages.ts');
	const html = await server.transformIndexHtml(path, pages.renderDevPage(root, locale));

	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	res.end(html);
}

/**
 * Serves both locale pages, rendered live from `data/`, and reloads the browser when the data changes.
 *
 * @returns The Vite plugin.
 */
function pages(): Plugin {
	return {
		name: 'scaleofdeaths-pages',

		/**
		 * Registers the page middleware and reloads the browser when the data or the build code changes.
		 *
		 * @param server Vite dev server.
		 */
		configureServer(server) {
			server.watcher.add(join(root, 'data'));

			server.watcher.on('all', (_event, file) => {
				if (RELOAD_ON_CHANGE.some((dir) => file.startsWith(dir)))
					server.ws.send({ type: 'full-reload' });
			});

			server.middlewares.use((req, res, next) => servePage(server, req, res, next));
		},
	};
}

export default defineConfig({
	appType: 'mpa',
	plugins: [pages()],
	server: { port: 5173 },
	preview: { port: 4173 },
	build: { outDir: 'dist' },
});
