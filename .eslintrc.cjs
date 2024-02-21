module.exports = {
  env: {
    browser: true,
    es2021: true,
    mocha: true,
    node: true
  },
  extends: 'standard',
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
  },
  overrides: [
    {
      files: ['src/tests/**/*.js'], // Adjust the glob patterns to match your test files
      rules: {
        'no-unused-expressions': 'off', // Disable no-unused-expressions for these files
      }
    }
  ]
}
