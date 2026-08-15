const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const importPlugin = require('eslint-plugin-import')
const nPlugin = require('eslint-plugin-n')
const noRelativeImportPathsPlugin = require('eslint-plugin-no-relative-import-paths')
const prettierConfig = require('eslint-config-prettier')
const globals = require('globals')

const TS_FILES = [
  'src/**/*.{ts,tsx}',
  'test/**/*.{ts,tsx}',
  'vitest.config.mts',
]
const tsTypeCheckedConfigs = tsPlugin.configs[
  'flat/recommended-type-checked'
].map((config) => ({
  ...config,
  files: TS_FILES,
}))

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // TypeScript ESLint recommended rules (flat config), scoped to TS files only.
  ...tsTypeCheckedConfigs,

  // TypeScript project config + repo-specific rules.
  {
    files: TS_FILES,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json', './test/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.worker,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      n: nPlugin,
      'no-relative-import-paths': noRelativeImportPathsPlugin,
    },
    rules: {
      'n/no-process-env': 'error',
      'no-relative-import-paths/no-relative-import-paths': 'error',
      'import/prefer-default-export': 'error',
      'import/order': [
        'error',
        {
          alphabetize: { caseInsensitive: false, order: 'asc' },
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'type',
          ],
          'newlines-between': 'never',
          pathGroups: [{ group: 'internal', pattern: '@/**' }],
        },
      ],
    },
  },

  // Disable ESLint rules that conflict with Prettier.
  prettierConfig,
]
