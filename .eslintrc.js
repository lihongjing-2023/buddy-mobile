module.exports = {
  extends: ['expo'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'android/',
    'ios/',
    'cockpit-tools/',  // symlink junction, not traversable
    'yudao-boot-mini/', // external dependency
    '*.config.js',
    '*.config.ts',
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/ban-ts-comment': 'off',

    // React Native / Expo
    'react-native/no-inline-styles': 'off',
    'react-native/no-color-literals': 'off',
    'react-native/split-platform-components': 'off',

    // General
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      },
    },
  ],
};
