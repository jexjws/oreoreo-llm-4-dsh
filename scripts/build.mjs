#!/usr/bin/env node
/**
 * Assemble the published `lib/` from the raw `tsc` output in `build/`.
 *
 * Two halves, two shapes:
 *
 *  - `lib/index.js` (host) stays ESM. The Cordis loader imports it with the
 *    Node ESM loader, so `import`/`export` is correct there.
 *  - `lib/client.js` (browser) must be a `window.__ModuleLoader__.load({...})`
 *    IIFE. Its static imports become `require(...)` calls resolved by the host,
 *    which is what keeps a single shared React instance across plugins.
 *
 * Keeping this in one script means `npm run build` is the whole pipeline and
 * there is no half-built state to forget to finish by hand.
 */

import { cp, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const MODULE_ID = 'oreoreo-llm-4-dsh';

await rm('lib/index.js', { force: true });
await rm('lib/client.js', { force: true });
await mkdir('lib', { recursive: true });

// 1. Host half: ESM, straight copy.
await cp('build/index.js', 'lib/index.js');

// 2. Browser half: rewrite+wrap into the loader envelope.
await run('node', ['scripts/wrap-client.mjs', 'build/client/index.js', 'lib/client.js', MODULE_ID], {
  stdio: 'inherit',
});

console.log('build: lib/index.js (esm) + lib/client.js (module-loader) ready');
