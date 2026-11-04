import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Code that must stay pure and deterministic (docs/04-game-engine-spec.md, rules E1–E3).
const PURE_FILES = ['packages/engine/src/**/*.ts', 'packages/games/*/src/rules/**/*.ts'];

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.tsx', 'apps/web/src/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Board components only get props: no app state, network or routing (docs/08 §2).
    files: ['packages/games/*/src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'socket.io-client', 'zustand', 'zustand/*'],
              message: 'Boards only use props (docs/08).',
            },
          ],
        },
      ],
    },
  },
  {
    files: PURE_FILES,
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'E2: no wall-clock time in the engine.' },
        { name: 'performance', message: 'E2: no wall-clock time in the engine.' },
        { name: 'crypto', message: 'E3: use ctx.rng for randomness.' },
        { name: 'fetch', message: 'E1: no I/O in the engine.' },
        { name: 'setTimeout', message: 'E1: no timers in the engine.' },
        { name: 'setInterval', message: 'E1: no timers in the engine.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'E3: use ctx.rng for randomness.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'react/*'], message: 'E1: rules must not depend on UI.' },
            { group: ['node:*'], message: 'E1: rules must run in the browser too.' },
            {
              group: ['@bg/ui', '@bg/ui/*', '@bg/bots', '@bg/bots/*'],
              message: 'See dependency rules in docs/03.',
            },
          ],
        },
      ],
    },
  },
);
