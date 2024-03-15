module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:css/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'pug', 'css'],
    root: true,
    ignorePatterns: ['**/*.css', '**/*.scss'],
    parserOptions: {
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        extraFileExtensions: ['.css', '.pug'],
    },
    rules: {
        'no-console': 'error',
        'consistent-return': 'error',
    },
};
