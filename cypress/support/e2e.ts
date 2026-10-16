/// <reference types="cypress" />

/**
 * Custom commands.
 *
 * `Cypress.Commands.add` is the framework's extension point — the equivalent of
 * `browser.addCommand` in WebdriverIO. Both exist for the same reason: to keep
 * a repeated multi-step interaction in one place instead of in every spec.
 */

declare global {
    /**
     * A namespace, not an ES module, because this is Cypress's own documented
     * augmentation point: `Chainable` lives in `namespace Cypress`, and
     * declaration merging only works against the same construct. Rewriting it
     * as a module declaration makes the custom commands invisible to the
     * compiler, so `cy.login()` becomes a type error everywhere.
     */
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            /** Log in through the form and wait for the secure area. */
            login(username?: string, password?: string): Chainable<void>;

            /**
             * Select by test id. Separate command so the attribute convention
             * is defined once — changing `data-test` to `data-testid` is then a
             * one-line change rather than a find-and-replace across specs.
             */
            byTestId(id: string): Chainable<JQuery<HTMLElement>>;
        }
    }
}

Cypress.Commands.add(
    'login',
    (
        // `Cypress.env` is typed `any`, so without the cast every downstream
        // use of these two values is unchecked.
        username = (Cypress.env('APP_USERNAME') as string | undefined) ?? 'tomsmith',
        password = (Cypress.env('APP_PASSWORD') as string | undefined) ?? 'SuperSecretPassword!',
    ) => {
        cy.visit('/login');
        cy.get('#username').type(username);
        // `log: false` keeps the password out of the command log and the
        // screenshots attached to a failure.
        cy.get('#password').type(password, { log: false });
        cy.get('button[type="submit"]').click();
        cy.get('#flash').should('contain', 'You logged into a secure area');
    },
);

Cypress.Commands.add('byTestId', (id: string) => cy.get(`[data-test="${id}"]`));

/**
 * The target site serves a few assets that occasionally 404, and an unrelated
 * asset failure should not fail a test about login. Narrow on purpose: only
 * genuinely unrelated errors are swallowed, everything else still fails.
 *
 * A blanket `return false` here is a common anti-pattern — it silences the
 * application's real exceptions along with the noise.
 */
Cypress.on('uncaught:exception', (err) => {
    if (/Failed to load resource|ResizeObserver loop/.test(err.message)) {
        return false;
    }
    return true;
});

export {};
