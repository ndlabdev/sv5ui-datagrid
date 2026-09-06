import type { Component } from 'svelte'
import InRoot from './InRoot.svelte'

/**
 * One part, mounted inside a grid.
 *
 * Every chrome and panel component takes its grid from context rather than
 * from a prop, so `render(Panel, { grid })` gets the error that says so. Nine
 * suites were each writing the same cast to get past `render`'s typing; it
 * lives here instead. Each of them keeps its own `inRoot`, because that one is
 * three lines and knows the row type.
 */
export const InGrid = InRoot as unknown as Component<Record<string, unknown>>
