module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    root: true,
    parserOptions: {
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        project: ['./tsconfig.json'], // Specify it only for TypeScript files
    },
    rules: {
        'no-console': 'error',
        'consistent-return': 'error'
    }
};
