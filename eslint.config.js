// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended')

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'web-build/*'],
  },
  {
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

      // Consistent import ordering 
      'sort-imports': ['error', {
        ignoreCase: true,
        ignoreDeclarationSort: true, // Let prettier handle this
      }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Use absolute imports instead of relative imports. Configure path mapping in tsconfig.json and use @app/* imports.',
            },
          ],
        },
      ],
      // Add a rule to use only absolute paths when possible
    },
  },
])
