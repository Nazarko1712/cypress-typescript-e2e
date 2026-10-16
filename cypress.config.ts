import { defineConfig } from 'cypress';

/**
 * Cypress configuration.
 *
 * The architectural difference from WebdriverIO, which drives most of the
 * decisions in this repo: Cypress runs the test code **inside the browser**,
 * in the same event loop as the application. WebdriverIO runs in Node and
 * talks to the browser over a protocol.
 *
 * What that buys: automatic retry-ability on every query and assertion, native
 * access to the page's network layer (`cy.intercept`), and time-travel
 * debugging.
 *
 * What it costs: no multi-tab support, no multi-origin navigation in one test
 * without `cy.origin`, and no true parallelism inside a single runner — the
 * free parallelism story is "shard across CI machines", not "N workers locally".
 *
 * Those trade-offs are the reason this suite targets the same site as the
 * sibling WebdriverIO project: with the application held constant, every
 * difference in the test code is attributable to the framework.
 */
export default defineConfig({
    e2e: {
        baseUrl: 'https://the-internet.herokuapp.com',
        specPattern: 'cypress/e2e/**/*.cy.ts',
        supportFile: 'cypress/support/e2e.ts',

        /**
         * Reporter.
         *
         * Cypress runs Mocha under the hood, so it accepts Mocha reporters and
         * ships `spec`, `junit` and `teamcity` without any extra dependency.
         * `junit` in CI is what makes a failure appear as a named test in the
         * GitHub Actions summary rather than as a line in a long log; `spec`
         * locally, where the console is being watched anyway.
         *
         * `[hash]` in the filename is not decoration — Cypress starts a fresh
         * reporter per spec file, so a fixed name means every spec overwrites
         * the previous one and the report describes only the last file that
         * ran.
         */
        reporter: process.env.CI ? 'junit' : 'spec',
        reporterOptions: {
            mochaFile: 'reports/junit-[hash].xml',
            toConsole: false,
        },

        viewportWidth: 1440,
        viewportHeight: 900,

        // Cypress retries queries until the assertion passes or this elapses.
        defaultCommandTimeout: 10_000,
        requestTimeout: 15_000,
        responseTimeout: 15_000,
        pageLoadTimeout: 30_000,

        // CI only: locally a flake should be seen and fixed, not retried away.
        retries: { runMode: 2, openMode: 0 },

        video: false,
        screenshotOnRunFailure: true,

        // The suite asserts on real responses, so recording them is pointless
        // noise — but leaving the hook in place documents where plugins go.
        setupNodeEvents(on) {
            on('task', {
                log(message: string) {
                    process.stdout.write(`${message}\n`);
                    return null;
                },
            });
        },
    },
});
