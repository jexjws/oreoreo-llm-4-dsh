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
 * The module id MUST equal the published package name, never the bare
 * directory name: DSH resolves the client half by package name, and a
 * mismatch surfaces at runtime as
 *   `loaded without registering "@scope/name" via __ModuleLoader__.load`
 * while the plugin otherwise appears installed. Read it from package.json so
 * a rename can never desync the two again.
 *
 * Keeping this in one script means `npm run build` is the whole pipeline and
 * there is no half-built state to forget to finish by hand.
 */

import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (!pkg.name) throw new Error('build: package.json has no name');
if (!pkg.version) throw new Error('build: package.json has no version');
const MODULE_ID = pkg.name;

await rm('lib/index.js', { force: true });
await rm('lib/client.js', { force: true });
await mkdir('lib', { recursive: true });

// 1. Host half: ESM, straight copy.
await cp('build/index.js', 'lib/index.js');

// 2. Browser half: rewrite+wrap into the loader envelope, keyed by package name.
await run('node', ['scripts/wrap-client.mjs', 'build/client/index.js', 'lib/client.js', MODULE_ID], {
  stdio: 'inherit',
});

// 3. Fail the build rather than ship a client half the loader cannot match.
const emitted = await readFile('lib/client.js', 'utf8');
const declared = /__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/.exec(emitted);
if (!declared) {
  throw new Error('build: lib/client.js does not call __ModuleLoader__.load({id})');
}
if (declared[1] !== MODULE_ID) {
  throw new Error(`build: client id ${JSON.stringify(declared[1])} != package name ${JSON.stringify(MODULE_ID)}`);
}

console.log(`build: lib/index.js (esm) + lib/client.js (module-loader id=${MODULE_ID}) ready`);
