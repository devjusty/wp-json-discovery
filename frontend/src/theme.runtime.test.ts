import { describe, expect, it } from 'vitest';
import mainSource from './main.tsx?raw';

describe('runtime theme loading', () => {
  it('loads theme tokens before App imports App.css', () => {
    expect(mainSource.indexOf("import './theme.css';")).toBeGreaterThanOrEqual(0);
    expect(mainSource.indexOf("import './theme.css';")).toBeLessThan(mainSource.indexOf("import App from './App';"));
  });
});
