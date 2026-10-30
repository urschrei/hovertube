import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['static/', 'node_modules/'] },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.node },
        },
    },
];
