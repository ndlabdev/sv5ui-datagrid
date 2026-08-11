/**
 * The public API, covered by semver and kept deliberately small. A symbol
 * earns a place by being something an app does with the grid — nothing is
 * exported because it happens to exist.
 *
 * The three barrels below name their exports one by one rather than
 * re-exporting modules wholesale, so nothing reaches an app by accident, and
 * `src/tests/public-api.test.ts` pins the resulting list. Between them, adding
 * to the surface takes a deliberate edit in two places.
 */

export * from './core/index.js'
export * from './components/index.js'
export * from './features/index.js'
