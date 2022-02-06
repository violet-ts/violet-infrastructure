module.exports = [
  {
    files: ['*.js', '*.jsx', '*.ts', '*.tsx', '*.mjs', '*.cjs', '*.mts', '*.cts'],
    rules: {
      camelcase: 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'prefer-destructuring': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-param-reassign': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'global-require': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/ban-types': 'off',
      'no-await-in-loop': 'off',
      'no-continue': 'off',

      quotes: ['error', 'single', { avoidEscape: true }],
    },
  },
];
