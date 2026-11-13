import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'server/node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, __BUILD_ID__: 'readonly', __BUILD_ENV__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Backend (Express en Vercel), scripts y configuración: corren en Node, no
  // en el navegador. Sin esto, `process`/`Buffer` salían como "no definidos".
  {
    files: ['server/**/*.js', 'api/**/*.js', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
