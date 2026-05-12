import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: [
    'node_modules/**',
    'build/**',
    'dist/**',
    '.trellis/**',
    '.github/**',
    'src/templates/**',
    'src/docker/webui/**/*.js',
  ],
  rules: {
    curly: ['error', 'all'],
    'style/brace-style': ['error', '1tbs'],
    'style/member-delimiter-style': 'off',
    'style/quote-props': 'off',
    'perfectionist/sort-imports': 'off',
    'perfectionist/sort-named-imports': 'off',
    'regexp/match-any': 'off',
    'e18e/prefer-object-has-own': 'off',
    'no-console': 'off',
    'ts/method-signature-style': 'off',
    'unicorn/new-for-builtins': 'off',
  },
})
