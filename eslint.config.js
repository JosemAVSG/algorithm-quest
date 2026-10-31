import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Architectural boundary (docs/07-architecture.md, rules R1 and R3).
    // The domain is pure TypeScript: no framework, no I/O, no adapters.
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'The domain layer must not depend on React (architecture rule R1).',
            },
            {
              group: ['**/features/**', '**/adapters/**'],
              message: 'The domain layer must not depend on features or adapters (architecture rule R3).',
            },
            {
              group: ['node:*', 'fs', 'path', 'url'],
              message: 'I/O belongs in adapters, not in the domain (architecture rule R3).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
