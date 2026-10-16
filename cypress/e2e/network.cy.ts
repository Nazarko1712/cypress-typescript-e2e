/**
 * Network control — the capability that genuinely separates Cypress from a
 * WebDriver-based tool.
 *
 * Because the test code runs INSIDE the browser, Cypress sits on the page's own
 * network layer. `cy.intercept` can observe, wait for, stub, delay or fail any
 * request without a proxy, a mock server or a code change in the application.
 *
 * WebdriverIO can do parts of this through CDP (`mock`, `throttle`), but it is
 * a bolt-on to a protocol-driven tool rather than the native model.
 *
 * Why this matters for testing, not just for demos: it turns "what happens when
 * the backend is slow / returns 500 / returns garbage" from a manual experiment
 * into an assertion — the resilience cases that otherwise never get covered.
 */
describe('Network interception', () => {
    it('waits for a real request instead of guessing at a delay', () => {
        cy.intercept('GET', '/dynamic_loading/2').as('page');
        cy.visit('/dynamic_loading/2');

        // Waiting on the request itself, not on a duration.
        cy.wait('@page').its('response.statusCode').should('eq', 200);
    });

    it('asserts on the real response of a page request', () => {
        cy.intercept('GET', '**/login').as('login');
        cy.visit('/login');

        cy.wait('@login').then((interception) => {
            expect(interception.response?.statusCode).to.eq(200);
            expect(interception.response?.headers['content-type']).to.contain('text/html');
        });
    });

    it('stubs a 500 so an error path can be tested at all', () => {
        // Forcing a 500 from the server is normally impossible from a test.
        //
        // The body must be valid HTML: `cy.visit` waits for the document load
        // event, and a bare text body never produces one — the failure reads as
        // "timed out waiting for your remote page to load", which points at the
        // network rather than at the payload.
        cy.intercept('GET', '/secure', {
            statusCode: 500,
            headers: { 'content-type': 'text/html' },
            body: '<html><body><h1>simulated outage</h1></body></html>',
        }).as('broken');

        cy.visit('/secure', { failOnStatusCode: false });

        cy.wait('@broken').its('response.statusCode').should('eq', 500);
        cy.contains('simulated outage').should('be.visible');
    });

    it('delays a response to exercise a slow backend', () => {
        cy.intercept('GET', '/dynamic_loading/2', (req) => {
            req.on('response', (res) => {
                res.setDelay(2000);
            });
            // `slow` cannot be used as an alias — Cypress reserves a set of
            // words, and aliasing one fails at runtime rather than at compile
            // time, so the error only appears when the test runs.
        }).as('slowPage');

        const started = Date.now();
        cy.visit('/dynamic_loading/2');
        cy.wait('@slowPage').then(() => {
            // Proves the delay was actually applied rather than ignored.
            expect(Date.now() - started).to.be.greaterThan(1800);
        });
    });

    it('survives a failed sub-resource', () => {
        // `forceNetworkError` cannot be applied to the top-level navigation:
        // killing the document request means there is no page to assert on, and
        // `cy.visit` fails before any test code runs.
        //
        // Applied to a sub-resource it answers a real question — does the page
        // still work when one asset dies?
        cy.intercept('GET', '**/forkme_right_sauce.svg', { forceNetworkError: true }).as('asset');

        cy.visit('/login');

        cy.get('#username').should('be.visible');
        cy.get('button[type="submit"]').should('be.enabled');
    });

    it('counts how many times an endpoint is called', () => {
        let calls = 0;
        cy.intercept('GET', '/abtest', () => {
            calls += 1;
        }).as('abtest');

        cy.visit('/abtest');
        cy.wait('@abtest');
        cy.visit('/abtest');
        cy.wait('@abtest');

        cy.then(() => {
            // Useful for caching and deduplication bugs: an endpoint hit twice
            // where it should be hit once is invisible to a UI-only assertion.
            expect(calls).to.eq(2);
        });
    });
});
