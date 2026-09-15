// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores(['dist', 'storybook-static']), js.configs.recommended, {
  files: ['**/*.{js,jsx,ts,tsx}'],
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
    parserOptions: {
      ecmaVersion: 'latest',
      ecmaFeatures: { jsx: true },
      sourceType: 'module',
    },
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'react-hooks/set-state-in-effect': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
  },
}, ...storybook.configs["flat/recommended"], {
  files: [tseslint.globs.ts],
  extends: [tseslint.configs.recommended],
},
])
