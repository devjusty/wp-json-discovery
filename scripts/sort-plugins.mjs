#!/usr/bin/env node
/**
 * Sorts SUPPORTED_PLUGINS alphabetically by label, then id, and rewrites plugins.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import * as pluginConfig from '../frontend/src/config/plugins.js';

const DEFAULT_CORE_NAMESPACES = [
  'wp/v2',
  'oembed/1.0',
  'wp-site-health/v1'
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.resolve(__dirname, '../frontend/src/config/plugins.js');

function main() {
  const SUPPORTED_PLUGINS = pluginConfig.SUPPORTED_PLUGINS ?? [];
  const CORE_NAMESPACES = Array.isArray(pluginConfig.CORE_NAMESPACES)
    ? pluginConfig.CORE_NAMESPACES
    : DEFAULT_CORE_NAMESPACES;

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
  const coreBody = inspect(CORE_NAMESPACES, {
    depth: null,
    compact: false,
    breakLength: 80,
    sorted: false,
    maxArrayLength: null
  });
  const contents = `${banner}export const SUPPORTED_PLUGINS = ${body};\n\nexport const CORE_NAMESPACES = ${coreBody};\n`;

  fs.writeFileSync(targetPath, contents, 'utf8');
  console.log(`Sorted ${sorted.length} plugins and wrote ${targetPath}`);
}

main();
