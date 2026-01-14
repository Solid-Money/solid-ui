// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended')
const simpleImportSort = require('eslint-plugin-simple-import-sort')

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'web-build/*', 'index.js'],
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'prettier/prettier': 'error',

      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        },
      ],

      // Allow console.log/warn/error in development
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Import sorting with CSS files always first
      'sort-imports': 'off', // Disable built-in sort-imports
      'simple-import-sort/imports': ['error', {
        groups: [
          // Side effect imports (CSS/global styles) always first
          ['^.+\\.css$'],
          // Node.js builtins
          ['^node:'],
          // External packages (react, expo, etc.)
          ['^react', '^expo', '^@?\\w'],
          // Internal @/ imports
          ['^@/'],
          // Parent imports
          ['^\\.\\.'],
          // Sibling imports
          ['^\\.'],
          // Type imports
          ['^.+\\u0000$'],
        ],
      }],
      'simple-import-sort/exports': 'error',

      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Image'],
              message: 'Use Image from "expo-image" or "@/components/ui/Image" instead for better performance and caching.',
            },
          ],
          patterns: [
            {
              group: ['../*'],
              message: 'Use absolute imports instead of relative imports. Configure path mapping in tsconfig.json and use @app/* imports.',
            },
          ],
        },
      ],
    },
  },
])
