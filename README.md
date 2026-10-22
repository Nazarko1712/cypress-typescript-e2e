# cypress-typescript-e2e

Cypress + TypeScript suite against **the same application** as
[wdio-typescript-e2e](https://github.com/Nazarko1712/wdio-typescript-e2e), so the
framework is the only variable and the two can be compared directly rather than
from documentation.

**27 tests, 4 spec files.** Target:
[the-internet.herokuapp.com](https://the-internet.herokuapp.com).

## Prerequisites

| Requirement          | Notes                                                    |
| -------------------- | -------------------------------------------------------- |
| **Node.js 20.18.1+** | pinned to 22 in `.nvmrc`                                 |
| **Cypress binary**   | downloaded by `npm ci` into `~/.cache/Cypress` (~300 MB) |
| **Network access**   | `the-internet.herokuapp.com`                             |

No Docker, no local services, no seed step.

## Setup

```bash
nvm use
npm ci
```

## Running

**Headless** — what CI runs, and the default:

```bash
npm test                 # all specs, headless Electron
npm run test:auth        # a single spec
npm run test:dynamic
npm run test:network
npm run test:limits
npx cypress run --browser chrome    # headless Chrome instead of Electron
```

**Headed** — watch it run:

```bash
npm run test:headed      # headed, browser stays open at the end
npm run open             # interactive Test Runner: time travel, DOM snapshots,
                         # selector playground, auto-rerun on save
npx cypress run --headed --browser chrome --no-exit
```

`npm run open` is the one to reach for when debugging: every command in the log
is clickable and shows the DOM as it was at that moment, which is Cypress's
strongest feature and has no direct WebdriverIO equivalent.

```bash
npm run typecheck        # tsc --noEmit, strict
```

## What this suite is for

Most Cypress portfolios re-implement a login flow. This one is written to answer
a question that comes up in interviews and is usually answered from blog posts:
**what can Cypress do that WebdriverIO cannot, and where does it refuse to go?**

Each spec is one half of that answer.

| Spec      | Tests | Theme                                               |
| --------- | ----- | --------------------------------------------------- |
| `auth`    | 6     | the shared baseline — same flow as the WDIO project |
| `network` | 6     | what Cypress does better: native request control    |
| `limits`  | 7     | what Cypress cannot do, and the workarounds         |
| `dynamic` | 8     | retry-ability, and where it stops helping           |

## The architectural difference

Cypress runs the test code **inside the browser**, in the same event loop as the
application. WebdriverIO runs in Node and talks to the browser over a protocol.

Everything below follows from that one fact.

**What it buys**

- Automatic retry-ability on every query and assertion. There is no
  `waitForDisplayed`, no `waitUntil` and no poller anywhere in this repository —
  waiting is a property of the assertion.
- Native access to the page's network layer. `cy.intercept` observes, stubs,
  delays and fails requests with no proxy and no change to the application.
- Time-travel debugging: the command log keeps a DOM snapshot per step.

**What it costs**

- One tab only. A `target="_blank"` link is tested by asserting the href or
  stripping the attribute; WebdriverIO switches window handles natively.
- No context switching for iframes. You reach into `contentDocument.body`
  yourself and wrap it so commands can chain.
- Native dialogs are auto-handled and never exposed; you assert through a
  `window:confirm` listener instead.
- No true in-process parallelism. Scaling means sharding across CI machines.

## Findings

Real problems hit while writing this suite, kept in the code with the mechanism
explained.

### A synthetic event cannot activate a CSS `:hover` rule

The clearest difference between the two frameworks, and the reason this
comparison is worth having.

The target styles its captions with `.figure:hover .figcaption`. The CSS
`:hover` pseudo-class is driven by the **real pointer position**, not by DOM
events — so `trigger('mouseover')` does not activate it and the caption stays
hidden however long Cypress retries.

The WebdriverIO project passes the equivalent test, because `moveTo()` moves an
actual pointer through the WebDriver Actions API.

Same scenario, same site: one framework can do it, the other cannot. The spec
asserts the limitation rather than hiding it, then verifies the caption's
contract without relying on hover. `invoke('show')` would make a green test that
proves less than it appears to; `cypress-real-events` solves it properly by
driving CDP.

### `slow` is a reserved alias

`cy.intercept(...).as('slow')` fails at **runtime**, not at compile time, with
`cannot be aliased as: 'slow'. This word is reserved`. The error only surfaces
when the test runs.

### A stubbed response needs a loadable body

Stubbing `/secure` with `body: 'simulated outage'` makes `cy.visit` hang until
`pageLoadTimeout`, reported as _"timed out waiting for your remote page to
load"_ — which points at the network rather than at the payload. `cy.visit`
waits for the document load event, and a bare text body never produces one. The
fix is valid HTML and a `text/html` content type.

### `forceNetworkError` cannot kill the top-level navigation

Killing the document request leaves no page to assert on, and `cy.visit` fails
before any test code runs. Applied to a sub-resource it answers a real question
instead: does the page still work when one asset dies?

### `#tinymce` is the body, not something inside it

The iframe editor is `<body id="tinymce">`, so `.find('#tinymce')` searches
descendants and finds nothing. The body returned by `.its('0.contentDocument.body')`
is already the target.

### Retry-ability does not extend to `.then()`

Code inside `.then()` runs **once**. A value captured there is a snapshot and
never updates, which is the same stale-snapshot trap as a `$$` array in
WebdriverIO — relocated rather than removed. `dynamic.cy.ts` asserts both halves.

## Conventions

**Custom commands over repeated steps, and no page objects.** `cy.login()` and
`cy.byTestId()` live in `cypress/support/e2e.ts`, the equivalent of
`browser.addCommand`. Defining the test-id attribute in one place means changing
the convention is a one-line edit rather than a find-and-replace.

That is a choice, not an omission. Custom commands are the Cypress-idiomatic
default: they compose with the command queue and are available everywhere
without an import, which suits cross-cutting actions. The Page Object Model
earns its place on long multi-page flows instead — see
[cypress-javascript-e2e](https://github.com/Nazarko1712/cypress-javascript-e2e),
which walks a six-screen checkout with page objects, so the two structures can
be compared with the framework held constant.

**Passwords typed with `{ log: false }`,** so they stay out of the command log
and out of the screenshots attached to a failure.

**`uncaught:exception` is narrowed, not blanketed.** A bare `return false`
silences the application's real exceptions along with the noise; this handler
matches two specific unrelated messages and lets everything else fail.

**`cy.session` for cached authentication,** so a UI login is paid for once rather
than in every test — the same goal the WebdriverIO project reaches by obtaining a
token over the API.

**Retries are CI-only.** Locally a flake should be seen and fixed.

## Linting and reports

```bash
npm run lint          # ESLint 9, flat config, type-checked rules
npm run lint:fix
npm run format        # Prettier, writes
npm run format:check  # Prettier, reports (this is what CI runs)
npm run typecheck     # tsc --noEmit
```

The Cypress-specific rules earn their keep here more than in any other project
in this portfolio, because the command queue makes two mistakes easy to write
and hard to see:

| Rule                                 | What it catches                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `cypress/no-assigning-return-values` | `const el = cy.get(...)` does not give you an element — commands are enqueued, not executed. The mistake every Selenium migrant makes once. |
| `cypress/unsafe-to-chain-command`    | chaining off an action command (`cy.click().type()`) re-queries a detached element                                                          |
| `cypress/no-async-tests`             | mixing `async/await` with the queue means the body finishes before the commands run                                                         |
| `cypress/no-unnecessary-waiting`     | `cy.wait(2000)` is the symptom of not having identified the real condition                                                                  |

`cy.wait('@alias')` stays allowed, and is the correct replacement for a fixed
sleep: it waits on the network event itself.

Two real fixes came out of this:

- `cy.get(...).type(...).should(...)` was split in two. Asserting off the return
  value of an action command re-queries an element the action may have replaced;
  when it bites, it bites as a detached-element error that reproduces only under
  load.
- `.then(cy.wrap)` passes the command as an unbound method reference. Replaced
  with `.then((body) => cy.wrap(body))`, which keeps the binding and reads better.

The `namespace Cypress` block in `cypress/support/e2e.ts` keeps an inline
`no-namespace` disable, with the reason attached: `Chainable` lives in a
namespace in Cypress's own types, and declaration merging only works against the
same construct. Rewriting it as a module makes `cy.login()` a type error
everywhere.

### Reports

Cypress runs Mocha underneath, so it accepts Mocha reporters and ships `spec`,
`junit` and `teamcity` with no extra dependency. CI uses `junit` and writes
`reports/junit-[hash].xml`; `spec` locally. The `[hash]` is not decoration —
Cypress starts a fresh reporter per spec file, so a fixed filename means every
spec overwrites the last and the report describes only the final file that ran.

### Pre-push hook

```bash
npm install    # wires the hook up via npm's `prepare` lifecycle script
```

`.husky/pre-push` runs the same checks CI runs, before the push leaves the
machine. If any of them exits non-zero, **the push is aborted and nothing
reaches the remote**:

```
  push blocked — ESLint found problems
  fix:     npm run lint:fix
  bypass:  git push --no-verify
```

Three deliberate choices in it:

**It does not run the suite.** Lint, formatting and types are fast, offline and
deterministic — the whole hook finishes in about four seconds. The tests need a
browser and/or somebody else's demo API, so a hook that ran them would add a
minute to every push and would block whenever that server is asleep. Those
belong in CI, where a retry is free.

**It never fixes anything.** The hook calls the reporting variants, never
`--fix` or `--write`. A hook that rewrites files during `git push` pushes a
version you never reviewed and leaves the corrected files uncommitted in your
working tree. Being told what to run is better than being silently corrected.

**It is a pre-push hook, not pre-commit.** Commits are cheap and often
intermediate; blocking each one trains you to reach for `--no-verify` until the
hook is decoration. One check before the branch leaves the machine catches
exactly what CI would catch, without getting in the way of committing
work-in-progress.

`git push --no-verify` skips it entirely and lets CI be the judge — a legitimate
choice for a branch that is not finished.

### Where this runs in CI

Linting and formatting are their **own job**, not steps inside the test job.
They need no browser, no network and no secrets, and they finish in seconds, so
as a separate job they run concurrently with the suite: a formatting failure
does not wait behind a long test run, and a real test failure is not hidden
behind a formatting failure. Both verdicts arrive on their own.

CI runs the `--check` variants, never the formatter itself. A pipeline reports
on the branch it was asked to verify; it does not rewrite it.
