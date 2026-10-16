/**
 * Authentication — the same flow as the WebdriverIO sibling project, written
 * the Cypress way, so the two can be compared directly.
 *
 * The visible difference: there is no `await` anywhere. Cypress commands are
 * ENQUEUED, not executed — `cy.get()` returns a chainable, not an element, and
 * nothing runs until the queue drains. That is why mixing `async/await` with
 * `cy` commands is a classic source of confusion: the await resolves
 * immediately while the command has not run yet.
 *
 * The practical consequence for assertions: `.should()` RETRIES the preceding
 * query until it passes or the timeout fires, so there is no explicit wait
 * anywhere in this file either — for a different reason than in Playwright.
 */
describe('Authentication', () => {
    beforeEach(() => {
        cy.visit('/login');
    });

    it('signs in with valid credentials', () => {
        cy.login();

        cy.url().should('include', '/secure');
        cy.get('a[href="/logout"]').should('be.visible');
    });

    it('rejects an unknown username', () => {
        cy.get('#username').type('not-a-real-user');
        cy.get('#password').type('SuperSecretPassword!', { log: false });
        cy.get('button[type="submit"]').click();

        cy.get('#flash').should('contain', 'Your username is invalid');
        cy.get('a[href="/logout"]').should('not.exist');
    });

    it('rejects a wrong password', () => {
        cy.get('#username').type('tomsmith');
        cy.get('#password').type('wrong-password', { log: false });
        cy.get('button[type="submit"]').click();

        cy.get('#flash').should('contain', 'Your password is invalid');
    });

    /**
     * Same security finding as the WebdriverIO project: the application returns
     * a DIFFERENT message for an unknown username than for a wrong password, so
     * the error text alone reveals which accounts exist. That is user
     * enumeration. A hardened login returns one identical message for both.
     *
     * Asserted as it behaves so the suite stays honest, and recorded here.
     */
    it('documents that error messages distinguish user from password', () => {
        cy.get('#username').type('definitely-not-a-user');
        cy.get('#password').type('whatever', { log: false });
        cy.get('button[type="submit"]').click();
        cy.get('#flash')
            .invoke('text')
            .then((unknownUser) => {
                cy.visit('/login');
                cy.get('#username').type('tomsmith');
                cy.get('#password').type('whatever', { log: false });
                cy.get('button[type="submit"]').click();
                cy.get('#flash')
                    .invoke('text')
                    .should((wrongPassword) => {
                        expect(unknownUser.trim()).not.to.equal(wrongPassword.trim());
                    });
            });
    });

    it('signs out and blocks the secure area afterwards', () => {
        cy.login();
        cy.get('a[href="/logout"]').click();

        cy.get('#flash').should('contain', 'You logged out of the secure area');

        cy.visit('/secure');
        cy.get('#flash').should('contain', 'You must login to view the secure area');
    });

    /**
     * Session caching: `cy.session` runs the setup once and restores cookies
     * and storage for every later test that asks for the same id. This is how a
     * Cypress suite avoids paying for a UI login in every single test — the
     * same goal the WebdriverIO project meets by obtaining a token over the API.
     */
    it('reuses a cached session instead of logging in again', () => {
        cy.session('tomsmith', () => {
            cy.visit('/login');
            cy.get('#username').type('tomsmith');
            cy.get('#password').type('SuperSecretPassword!', { log: false });
            cy.get('button[type="submit"]').click();
            cy.get('#flash').should('contain', 'You logged into a secure area');
        });

        cy.visit('/secure');
        cy.get('a[href="/logout"]').should('be.visible');
    });
});
