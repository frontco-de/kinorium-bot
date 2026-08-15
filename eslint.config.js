const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const importPlugin = require('eslint-plugin-import-x')
const nPlugin = require('eslint-plugin-n')
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
      'import-x': importPlugin,
      n: nPlugin,
    },
    rules: {
      'n/no-process-env': 'error',
      // Replaces eslint-plugin-no-relative-import-paths, which still calls the
      // context APIs ESLint 10 removed. `@/`, `@locales/`, and `@migrations/`
      // stay the only ways to reach repository modules.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message: 'Import repository modules through the @/ alias.',
            },
          ],
        },
      ],
      'import-x/prefer-default-export': 'error',
      'import-x/order': [
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
