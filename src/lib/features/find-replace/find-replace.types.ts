export interface FindReplaceOptions {
    /**
     * Offer Replace alongside Find. Turning it off leaves a read-only find
     * box - the panel drops its replace row and `Ctrl/⌘+H` does nothing.
     * @default true
     */
    replace?: boolean

    /**
     * Bind `Ctrl/⌘+F` and `Ctrl/⌘+H` while `<FindReplace>` is mounted.
     *
     * The listener is on `window`, not on the grid, and it calls
     * `preventDefault` - which is what a grid-wide find has to do to be
     * reachable at all: a shortcut scoped to the grid does nothing until the
     * user has clicked into it, and the browser's own find opens instead.
     * The cost is that these two keys belong to the grid for as long as the
     * panel is mounted, so an app that wants them back sets this false.
     * @default true
     */
    hotkeys?: boolean

    /**
     * Allow Replace on a grid built with `rowModel: 'server'`.
     *
     * Off by default, and the default is the safe one. Under a server model
     * the grid holds one page, or the blocks scrolled through; an edit writes
     * into that copy, and the next fetch overwrites it. Measured: replacing
     * ten cells on page one, paging away and back, and every one of them is
     * the value the server still has - while the panel had reported success.
     *
     * Turn it on only when edits reach whatever `getRows` reads from, which
     * is something only the app knows. Find itself is unaffected; it searches
     * what has been loaded either way, and says so.
     */
    serverReplace?: boolean
}
