// Flat ESLint config for ESLint v9+
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';

export default [
  { ignores: ['dist', 'public/demo-seed.json'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin
    },
    rules: {
      'react/react-in-jsx-scope': 'off'
    },
    settings: { react: { version: '18.0' } }
  }
];

