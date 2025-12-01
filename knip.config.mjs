import { defineConfig } from 'knip';

export default defineConfig({
  ignore: ['server/data/**', 'frontend/dist/**'],
  workspaces: {
    frontend: {
      entry: ['src/main.jsx'],
      project: ['src/**/*.{js,jsx}'],
      ignore: ['src/__tests__/**']
    },
    server: {
      entry: ['src/index.js'],
      project: ['src/**/*.js'],
      ignore: ['data/**']
    }
  }
});
