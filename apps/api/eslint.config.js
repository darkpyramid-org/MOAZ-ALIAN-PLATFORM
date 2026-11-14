import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config. Non-type-aware rules only: the codebase is small and
 * type-aware linting doubles CI time for rules the compiler already covers.
 */
export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', '*.js', 'prisma/generated/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': 'error',
    },
  },
);
