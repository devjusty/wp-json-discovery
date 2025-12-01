import { readFileSync } from 'node:fs';

export function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .forEach((line) => {
        const [key, ...valueParts] = line.split('=');
        if (!key || process.env[key] !== undefined) {
          return;
        }
        const value = valueParts.join('=').trim();
        process.env[key] = value;
      });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[env] Failed to load ${filePath}: ${error.message}`);
    }
  }
}
