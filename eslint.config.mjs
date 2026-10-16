import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import cypress from 'eslint-plugin-cypress';
import prettier from 'eslint-config-prettier';

/**
 * ESLint 9 flat config.
 *
 * The Cypress-specific rules matter more here than in any other repo in this
 * portfolio, because Cypress's command queue makes two mistakes very easy to
 * write and very hard to see:
 *
 *   cypress/no-unnecessary-waiting   `cy.wait(2000)` is the symptom of not
 *                                    having identified the real condition. It
 *                                    is also the single biggest source of flake
 *                                    and of slow suites.
 *   cypress/unsafe-to-chain-command  chaining off an action command
 *                                    (`cy.click().type()`) re-queries a
 *                                    detached element.
 *   cypress/no-assigning-return-values  `const el = cy.get(...)` does not give
 *                                    you an element — commands are enqueued,
 *                                    not executed, so the value is a chainer.
 *                                    This is the mistake every Selenium
 *                                    migrant makes once.
 *   cypress/no-async-tests           mixing async/await with the queue means
 *                                    the test body finishes before the
 *                                    commands run.
 *
 * `cy.wait('@alias')` is still allowed, and is the correct replacement for a
 * fixed sleep: it waits on the network event itself.
 */
export default tseslint.config(
    {
        ignores: [
            'node_modules/',
            'cypress/screenshots/',
            'cypress/videos/',
            'cypress/downloads/',
            'eslint.config.mjs',
        ],
    },

    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,

    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/require-await': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },

    {
        files: ['cypress/**/*.ts'],
        ...cypress.configs.recommended,
        rules: {
            ...cypress.configs.recommended.rules,
            'cypress/no-unnecessary-waiting': 'error',
            'cypress/unsafe-to-chain-command': 'error',
            'cypress/no-assigning-return-values': 'error',
            'cypress/no-async-tests': 'error',
        },
    },

    prettier,
);
