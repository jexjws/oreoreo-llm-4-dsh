#!/usr/bin/env node
/**
 * Wrap the compiled client bundle in DSH's browser module loader envelope.
 *
 * ## Why this step exists
 *
 * DSH's web client does not load plugin bundles as ES modules. Every shipped
 * browser half is an IIFE that calls
 *
 *     window.__ModuleLoader__.load({ id, factory: (require) => {...} })
 *
 * and pulls its dependencies through the injected `require`, because the host
 * owns module identity (two plugins must share *one* React instance).
 *
 * `tsc` cannot emit that envelope: it only knows ESM. Rather than add a bundler
 * for a plugin with a single import, this script rewrites the few static
 * imports `tsc` produced into `require(...)` calls and wraps the body. It fails
 * loudly on any import shape it does not recognise, so a new dependency cannot
 * silently ship a bundle the loader will not run.
 *
 * Usage: node scripts/wrap-client.mjs <in.js> <out.js> <module-id>
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , inFile, outFile, moduleId] = process.argv;

if (!inFile || !outFile || !moduleId) {
  console.error('usage: wrap-client.mjs <in.js> <out.js> <module-id>');
  process.exit(2);
}

let source = await readFile(inFile, 'utf8');

/** Collected `const <local> = require('<spec>')` lines, hoisted above the body. */
const requires = [];
/** map of local binding -> imported name, for rewriting specifiers in place. */
const renames = new Map();

// 1. Default imports:        import X from 'spec';
// 2. Named imports:          import { a as b, c } from 'spec';
// 3. Namespace imports:      import * as X from 'spec';
// 4. Side-effect imports:    import 'spec';
const IMPORT_RE =
  /^import\s+(?:(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?|\*\s+as\s+([A-Za-z_$][\w$]*)|(['"][^'"]+['"]))\s*(?:from\s*)?(['"][^'"]+['"]);?[ \t]*$/gm;

source = source.replace(
  IMPORT_RE,
  (_match, defaultName, namedBlock, nsName, bareSpec, fromSpec) => {
    const spec = fromSpec ?? bareSpec;
    if (spec === undefined) {
      throw new Error(`unparseable import: ${_match}`);
    }
    const clean = spec.replace(/^['"]|['"]$/g, '');
    const local = `__dep_${requires.length}`;
    requires.push(`var ${local} = require(${JSON.stringify(clean)});`);

    if (bareSpec !== undefined) {
      return ''; // side-effect only
    }
    if (nsName) {
      renames.set(nsName, local);
      return '';
    }
    const parts = [];
    if (defaultName) {
      // tsc emits `import X from 'm'` for a default export; the CommonJS
      // interop the shipped bundles use reads `.default` when present.
      const binding = `${local}.default !== undefined ? ${local}.default : ${local}`;
      parts.push(`var ${defaultName} = ${binding};`);
    }
    if (namedBlock) {
      for (const piece of namedBlock.split(',')) {
        const trimmed = piece.trim();
        if (trimmed === '') continue;
        const [importedName, localName] = trimmed.split(/\s+as\s+/);
        const target = localName ?? importedName;
        parts.push(`var ${target} = ${local}.${importedName};`);
      }
    }
    if (parts.length === 0) {
      throw new Error(`import with no bindings: ${_match}`);
    }
    return parts.join(' ');
  },
);

// Inline `export function f` / `export const x` / `export class C` forms: drop
// the keyword and remember the name so it can be re-exported below.
const inlineExports = [];
source = source.replace(
  /^export\s+(?:async\s+)?(function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm,
  (_m, kind, name) => {
    inlineExports.push(name);
    return `${kind} ${name}`;
  },
);

// A tsc-emitted `export { a, b }` becomes plain assignments on exports.
source = source.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_m, names) => {
  return names
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => {
      const [localName, exportedAs] = piece.split(/\s+as\s+/);
      const key = exportedAs ?? localName;
      inlineExports.push(key === localName ? localName : `${localName}:${key}`);
      return '';
    })
    .join(' ');
});

if (inlineExports.length > 0) {
  const lines = inlineExports.map((entry) => {
    const [localName, exportedAs] = entry.includes(':') ? entry.split(':') : [entry, entry];
    return `exports[${JSON.stringify(exportedAs)}] = ${localName};`;
  });
  source += '\n' + lines.join('\n') + '\n';
}

// Any surviving import/export means an unsupported shape.
if (/^\s*(?:import|export)\s/m.test(source)) {
  console.error(
    `wrap-client: unsupported module syntax left in ${inFile}:\n${source
      .split('\n')
      .filter((line) => /^\s*(?:import|export)\s/.test(line))
      .slice(0, 5)
      .join('\n')}`,
  );
  process.exit(1);
}

// Namespace imports referenced as `X.foo` become `__dep_0.foo`; done after the
// import rewrite so the substitutions cannot collide with the generated names.
for (const [localName, replacement] of renames) {
  source = source.replace(
    new RegExp(`\\b${localName.replace(/\$/g, '\\$')}\\b`, 'g'),
    replacement,
  );
}

const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(moduleId)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${requires.map((line) => '\t\t' + line).join('\n')}
${source
  .split('\n')
  .map((line) => (line.length === 0 ? line : '\t\t' + line))
  .join('\n')}
\t\treturn module.exports;
\t}
});
`;

await writeFile(outFile, wrapped, 'utf8');
console.log(
  `wrap-client: ${path.basename(inFile)} -> ${path.basename(outFile)} (${requires.length} requires)`,
);
