/**
 * Dynamic rendering — the same scenarios as `dynamic-loading.spec.ts` in the
 * WebdriverIO project, so the two files can be read side by side.
 *
 * The difference is what is NOT here: no `waitForExist`, no `waitForDisplayed`,
 * no `waitUntil`, no poller. Cypress retries the query attached to an assertion
 * until it passes or `defaultCommandTimeout` elapses, so waiting is a property
 * of the assertion rather than a separate step.
 *
 * The cost of that convenience: retry-ability only applies to queries, not to
 * arbitrary code. Anything inside `.then()` runs ONCE, which is why the stale
 * snapshot problem still exists here — it just moves.
 */
describe('Dynamic rendering', () => {
    it('waits for an element injected after the action', () => {
        cy.visit('/dynamic_loading/2');
        cy.get('#start button').click();

        // No explicit wait: the assertion drives the retry.
        cy.get('#finish', { timeout: 15_000 })
            .should('be.visible')
            .and('have.text', 'Hello World!');
    });

    it('the element does not exist before the action', () => {
        cy.visit('/dynamic_loading/2');

        cy.get('#finish').should('not.exist');
    });

    it('distinguishes hidden from absent', () => {
        // /1 keeps the element in the DOM and hides it;
        // /2 injects it only after the action. Same symptom, different cause.
        cy.visit('/dynamic_loading/1');
        cy.get('#finish').should('exist').and('not.be.visible');

        cy.visit('/dynamic_loading/2');
        cy.get('#finish').should('not.exist');
    });

    it('a value captured in .then() does not update on retry', () => {
        cy.visit('/dynamic_loading/2');

        // `.then()` runs once, so whatever it captures is a snapshot. The same
        // trap as a `$$` array in WebdriverIO, relocated rather than removed.
        cy.get('body').then(($body) => {
            const before = $body.find('#finish').length;
            expect(before).to.eq(0);
        });

        cy.get('#start button').click();
        cy.get('#finish', { timeout: 15_000 }).should('be.visible');

        cy.get('body').then(($body) => {
            // A fresh query sees it; the earlier capture never would have.
            expect($body.find('#finish').length).to.eq(1);
        });
    });

    it('waits for a control to become enabled', () => {
        cy.visit('/dynamic_controls');

        cy.get('#input-example input').should('be.disabled');
        cy.get('#input-example button').click();

        cy.get('#input-example input', { timeout: 15_000 }).should('be.enabled');
        // Split rather than chained: `.type()` is an action command, and
        // asserting off its return value re-queries an element that the action
        // may have replaced. `cypress/unsafe-to-chain-command` flags it, and
        // the failure mode when it bites is a detached-element error that
        // reproduces only under load.
        cy.get('#input-example input').type('now editable');
        cy.get('#input-example input').should('have.value', 'now editable');
    });

    it('waits for a control to be removed from the DOM', () => {
        cy.visit('/dynamic_controls');

        cy.get('#checkbox input').should('exist');
        cy.get('#checkbox-example button').click();

        cy.get('#checkbox input', { timeout: 15_000 }).should('not.exist');
        cy.get('#message').should('have.text', "It's gone!");
    });

    /**
     * A genuine framework limit, not a bug in this test.
     *
     * The target styles the caption with `.figure:hover .figcaption`. The CSS
     * `:hover` pseudo-class is driven by the REAL pointer position, not by DOM
     * events — so a synthetic `trigger('mouseover')` does not activate it. The
     * caption stays hidden no matter how long Cypress retries.
     *
     * The sibling WebdriverIO project passes the equivalent test because
     * `moveTo()` moves an actual pointer through the WebDriver Actions API.
     * Same scenario, same site; one framework can do it and the other cannot.
     *
     * Workarounds, in order of honesty:
     *   1. assert the content is correct even while hidden (below)
     *   2. force the style with `invoke('show')` — tests the assertion, not the
     *      interaction, so it proves less than it appears to
     *   3. use `cy.realHover()` from cypress-real-events, which drives CDP
     */
    it('cannot activate a CSS :hover rule with a synthetic event', () => {
        cy.visit('/hovers');

        cy.get('.figure').first().trigger('mouseover');

        // Still hidden: the synthetic event never reaches the CSS engine.
        cy.get('.figure').first().find('.figcaption').should('not.be.visible');
    });

    it('verifies hover-gated content without relying on hover', () => {
        cy.visit('/hovers');

        // The caption is in the DOM from page load, so its contract can be
        // checked even though it is not displayed.
        cy.get('.figure')
            .first()
            .find('.figcaption')
            .should('exist')
            .find('h5')
            .should('have.text', 'name: user1');

        cy.get('.figure').first().find('.figcaption a').should('have.attr', 'href', '/users/1');
    });
});
