import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Repo rule: every `interface` and `type` alias lives in `src/types/`.
 * Implementation files import them; they never declare them.
 */
const typesFolderOnly = {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'TSInterfaceDeclaration',
      message: 'Declare interfaces in src/types/ and import them here.',
    },
    {
      selector: 'TSTypeAliasDeclaration',
      message: 'Declare type aliases in src/types/ and import them here.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: typesFolderOnly,
  },
  {
    files: ['src/types/**/*.ts', 'test/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
