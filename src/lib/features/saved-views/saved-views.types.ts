import { type GridSnapshot } from '../../core/types/index.js'

/** One named arrangement of the grid: its columns, density, sort, filter and grouping. */
export interface SavedView {
    /** Stable across renames; what `apply` and share links address. */
    id: string
    name: string
    snapshot: GridSnapshot
}

/**
 * Where the list of views lives between sessions.
 *
 * Deliberately synchronous. A backend-backed list is asynchronous, and making
 * this async would put a loading state into every read; an app with a server
 * instead loads its own list and hands it to `views`, then writes on
 * `onChange`. The built-in adapter is `localStorage`.
 */
export interface SavedViewStorage {
    read(key: string): SavedView[] | null
    write(key: string, views: SavedView[]): void
}

export interface SavedViewsOptions {
    /**
     * Views to start with. Anything read from `storage` is merged over these,
     * so seeded defaults survive a user who has saved views of their own.
     */
    views?: SavedView[]

    /**
     * Persistence. `null` keeps the list in memory for the session only.
     * @default localStorage
     */
    storage?: SavedViewStorage | null

    /**
     * Key the storage adapter writes under. Two grids in one app need two
     * keys, or they overwrite each other's views.
     * @default 'sv5ui-datagrid:views'
     */
    key?: string

    /** Called after any change, for an app persisting the list itself. */
    onChange?: (views: SavedView[]) => void
}
