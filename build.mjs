import * as esbuild from 'esbuild';
import { copyFile } from 'node:fs/promises';

import browserslist from 'browserslist';
import { resolveToEsbuildTarget } from 'esbuild-plugin-browserslist';

const options = {
    entryPoints: { script: 'src/main.js' },
    bundle: true,
    // MapLibre 6 is ESM-only and locates its worker via import.meta.url
    format: 'esm',
    minify: true,
    sourcemap: true,
    outdir: 'static',
    target: resolveToEsbuildTarget(browserslist(), { printUnknownTargets: false }),
};

// The worker is loaded from next to the bundle, so ship it alongside
await copyFile('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'static/maplibre-gl-worker.mjs');

if (process.argv.includes('--serve')) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    const { hosts, port } = await ctx.serve({ servedir: '.' });
    console.log(`Serving on http://${hosts[0]}:${port}/`);
} else {
    await esbuild.build(options);
}
