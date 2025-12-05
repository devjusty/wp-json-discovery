#!/usr/bin/env node
/**
 * Sorts SUPPORTED_PLUGINS alphabetically by label, then id, and rewrites plugins.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { SUPPORTED_PLUGINS } from '../frontend/src/config/plugins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.resolve(__dirname, '../frontend/src/config/plugins.js');

function main() {
  const sorted = [...SUPPORTED_PLUGINS].sort((a, b) => {
    const label = (a.label || a.id || '').localeCompare(b.label || b.id || '');
    if (label !== 0) return label;
    return (a.id || '').localeCompare(b.id || '');
  });

  const banner = '// This file is generated via scripts/sort-plugins.mjs to keep plugins sorted.\n';
  const body = inspect(sorted, {
    depth: null,
    compact: false,
    breakLength: 80,
    sorted: false,
    maxArrayLength: null
  });
  const contents = `${banner}export const SUPPORTED_PLUGINS = ${body};\n`;

  fs.writeFileSync(targetPath, contents, 'utf8');
  console.log(`Sorted ${sorted.length} plugins and wrote ${targetPath}`);
}

main();
