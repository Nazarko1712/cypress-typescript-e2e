/**
 * Where Cypress hits its architectural limits.
 *
 * Running inside the browser buys retry-ability and native network control. It
 * also imposes constraints that a protocol-driven tool like WebdriverIO does not
 * have. This spec demonstrates each limit and the workaround, rather than
 * pretending they are not there — choosing a framework means knowing what it
 * refuses to do.
 */
describe('Framework limits and their workarounds', () => {
    /**
     * LIMIT 1 — no native dialogs.
     *
     * Cypress auto-handles `alert`, `confirm` and `prompt` and does not expose
     * them as dialogs at all; there is nothing to accept or dismiss. Instead you
     * assert through an event listener.
     *
     * Interesting contrast: the sibling WebdriverIO project had to DROP its
     * dialog coverage because ChromeDriver handled the prompt inside `click()`
     * non-deterministically. Cypress reaches the same destination by design,
     * deterministically — the stub is part of the model, not an accident.
     */
    it('asserts on window.confirm through an event, since dialogs are auto-handled', () => {
        cy.visit('/javascript_alerts');

        const stub = cy.stub().as('confirmed');
        cy.on('window:confirm', stub);

        cy.get('button[onclick="jsConfirm()"]').click();

        cy.get('@confirmed').should('have.been.calledWith', 'I am a JS Confirm');
        // Auto-accepted, so the page reports Ok.
        cy.get('#result').should('have.text', 'You clicked: Ok');
    });

    it('returns false from the listener to simulate Cancel', () => {
        cy.visit('/javascript_alerts');

        cy.on('window:confirm', () => false);

        cy.get('button[onclick="jsConfirm()"]').click();
        cy.get('#result').should('have.text', 'You clicked: Cancel');
    });

    /**
     * LIMIT 2 — one tab only.
     *
     * Cypress cannot drive a second tab. A `target="_blank"` link is therefore
     * tested by removing the attribute so the navigation happens in place, or by
     * asserting the href and visiting it directly.
     *
     * WebdriverIO handles this natively with `getWindowHandles` and
     * `switchToWindow`.
     */
    it('tests a new-tab link by asserting the href rather than opening it', () => {
        cy.visit('/windows');

        cy.get('a[href="/windows/new"]')
            .should('have.attr', 'target', '_blank')
            .and('have.attr', 'href', '/windows/new');

        // Verify the destination by visiting it directly.
        cy.visit('/windows/new');
        cy.get('h3').should('have.text', 'New Window');
    });

    it('or by stripping target so the link opens in place', () => {
        cy.visit('/windows');

        cy.get('a[href="/windows/new"]').invoke('removeAttr', 'target').click();

        cy.get('h3').should('have.text', 'New Window');
    });

    /**
     * LIMIT 3 — iframes are awkward.
     *
     * There is no `switchToFrame`. You reach into the frame's document yourself
     * and wrap the result so Cypress commands can chain off it. Note the
     * `.its('0.contentDocument.body')` dance and the readiness check — the
     * frame body exists before it is populated, so asserting on it too early
     * finds an empty node.
     *
     * The sibling WebdriverIO project switches context in one call and restores
     * it in `finally`. Cypress trades that simplicity for not having a context
     * to lose in the first place.
     */
    it('reaches into an iframe by wrapping its document body', () => {
        cy.visit('/iframe');

        // `#tinymce` IS the body element (`<body id="tinymce">`), not something
        // inside it — so `.find('#tinymce')` searches descendants and finds
        // nothing. The body returned by `.its()` is already the target.
        cy.get('#mce_0_ifr')
            .its('0.contentDocument.body')
            .should('not.be.empty')
            .then((body: HTMLElement) => cy.wrap(body))
            .should('have.id', 'tinymce')
            .and('contain.text', 'Your content goes here.');
    });

    it('types into an iframe body', () => {
        cy.visit('/iframe');

        cy.get('#mce_0_ifr')
            .its('0.contentDocument.body')
            .should('not.be.empty')
            .then((body: HTMLElement) => cy.wrap(body))
            .clear();

        // `.clear()` is an action command, so the chain stops there and the
        // typing starts from a fresh query.
        cy.get('#mce_0_ifr')
            .its('0.contentDocument.body')
            .then((body: HTMLElement) => cy.wrap(body))
            .type('typed inside the frame');

        cy.get('#mce_0_ifr')
            .its('0.contentDocument.body')
            .then((body: HTMLElement) => cy.wrap(body))
            .should('contain.text', 'typed inside the frame');
    });

    /**
     * LIMIT 4 — file downloads are not observable in the browser.
     *
     * Cypress cannot inspect the OS download. The practical approach is to
     * assert the link's contract and fetch the resource with `cy.request`,
     * which bypasses the browser entirely.
     */
    it('verifies a download by requesting it rather than clicking it', () => {
        cy.visit('/download');

        // The download list is user-generated and some entries 404, so the
        // request must not abort the test on a bad status — assert on it
        // instead. `failOnStatusCode: false` is what makes that possible.
        cy.get('#content a')
            .first()
            .invoke('attr', 'href')
            .then((href) => {
                expect(href, 'link has an href').to.be.a('string');
                cy.request({ url: `/${href}`, failOnStatusCode: false }).then((response) => {
                    expect(response.status).to.eq(200);
                    expect(response.headers).to.have.property('content-type');
                });
            });
    });
});
