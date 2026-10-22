import { defineConfig, devices } from '@playwright/test';

/** Build of the edge-case fixture dataset, used by most tests. */
const EDGE = 'http://localhost:4175';

/** Build of the real dataset, used by the smoke tests. */
const REAL = 'http://localhost:4174';

const serveEdgeBuild = [
	'bun tests/fixtures/make-edge.ts',
	'SOD_DATA_ROOT=tests/fixtures/edge SOD_OUT_DIR=dist-edge bun scripts/build.ts',
	'vite preview --outDir dist-edge --port 4175 --strictPort',
].join(' && ');

const serveRealBuild = ['bun scripts/build.ts', 'vite preview --port 4174 --strictPort'].join(
	' && ',
);

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	reporter: [['list']],
	use: { baseURL: EDGE },

	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
	],

	webServer: [
		{ command: serveEdgeBuild, url: EDGE, reuseExistingServer: false },
		{ command: serveRealBuild, url: REAL, reuseExistingServer: false },
	],
});
