module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    Phaser: 'readonly',
    __DEV__: 'readonly'
  },
  rules: {
    // Phaser-specific adjustments
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'camelcase': 'off', // Phaser uses snake_case for some APIs
    'no-new': 'off', // Allow 'new Phaser.Game()'
    
    // Code style consistency
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'never'],
    'space-before-function-paren': ['error', 'always'],
    
    // Performance considerations
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off'
  }
}