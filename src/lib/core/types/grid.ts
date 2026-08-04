import type { ColumnDef, PinnedSide } from './columns.js'
import type { DataGridLabelsInput, DataGridLocalePack } from './labels.js'
import type { FilterModel } from './filtering.js'
import type { GridFeature } from './feature.js'
import type { ClassNameValue } from 'tailwind-merge'
import type { RowModel, RowNode, RowPinSide } from './rows.js'
import type { SortDirection, SortState } from './sorting.js'

/** Grid-level configuration, snapshots and the event surface. */

export type SelectionMode = 'single' | 'multiple'

export type Density = 'compact' | 'standard' | 'comfortable'

/** Strings the aria-live announcer speaks. Seen strings live in `DataGridLabels`. */
export interface DataGridAnnouncerStrings {
    /** Announced when a column becomes sorted. */
    sorted: (column: string, direction: SortDirection) => string
    /** Announced when sorting is cleared. */
    sortCleared: () => string
    /** Announced with the post-filter row count when the filter changes. */
    filtered: (count: number) => string
    /** Announced when the page changes. */
    page: (page: number) => string
    /** Announced when a column is resized. */
    columnResized: (column: string, width: number) => string
    /** Announced when a column is moved. */
    columnMoved: (column: string, position: number) => string
    /** Announced when a column is pinned or unpinned. */
    columnPinned: (column: string, side: PinnedSide | null) => string
    /** Announced when a column is hidden or shown. */
    columnVisibility: (column: string, hidden: boolean) => string
    /** Announced with the selected row count when the selection changes. */
    selected: (count: number) => string
    /** Announced after rows are copied to the clipboard. */
    copied: (count: number) => string
    /** Announced when a row is expanded or collapsed. */
    rowExpanded: (expanded: boolean) => string
    /** Announced when a row is pinned or unpinned. */
    rowPinned: (side: RowPinSide | null) => string
    /** Announced with the row's new 1-based position after a move. */
    rowMoved: (position: number) => string
    /** Announced when a commit is blocked by validation. */
    editInvalid: (message: string) => string
}

/** Bumped when the snapshot shape changes in a way `migrate` must handle. */
export const SNAPSHOT_VERSION = 1

/**
 * A versioned, JSON-serializable view of everything the user can rearrange.
 * Column identity is by id, so adding or removing columns between sessions is
 * safe: unknown ids are dropped and new ones keep their defaults.
 */
export interface GridSnapshot {
    version: number
    columns?: {
        order?: string[]
        widths?: Record<string, number>
        hidden?: Record<string, boolean>
        pinned?: Record<string, PinnedSide | null>
    }
    density?: Density
    /** Per-feature slices, keyed by feature id. */
    features?: Record<string, unknown>
}

/**
 * Restores from `localStorage` synchronously before the first client paint, so
 * a client-rendered grid shows the saved layout with no flash. Under SSR the
 * server cannot read `localStorage`, so it paints the defaults and the client
 * corrects them after hydration — render a persisted grid client-side (e.g.
 * `export const ssr = false`) to avoid that flash.
 */
export interface PersistStateOptions {
    /** localStorage key. */
    key: string
    /**
     * Upgrades a snapshot written by an older version of your app. Return
     * undefined to discard it and start from the column defaults.
     */
    migrate?: (stored: GridSnapshot) => GridSnapshot | undefined
}

/** Typed event map of the grid event bus. Features and later phases extend this surface. */
export interface GridEventMap {
    sortChanged: { sort: SortState[] }
    filterChanged: { filter: FilterModel }
    pageChanged: { page: number; pageSize: number | null }
    columnResized: { columnId: string; width: number }
    columnMoved: { columnId: string; toIndex: number }
    columnPinned: { columnId: string; side: PinnedSide | null }
    columnVisibilityChanged: { columnId: string; hidden: boolean }
    selectionChanged: { selectedIds: string[] }
    rowsCopied: { count: number }
    rowExpanded: { id: string; expanded: boolean }
    rowPinnedChanged: { id: string; side: RowPinSide | null }
    rowMoved: { id: string; from: number; to: number }
    cellEdited: { rowId: string; columnId: string; oldValue: unknown; newValue: unknown }
    rowEdited: { rowId: string; changes: Record<string, unknown> }
}

export interface DataGridOptions<TRow> {
    /** Column definitions. */
    columns: ColumnDef<TRow>[]

    /** The rows to display (client row model). */
    data?: TRow[]

    /**
     * Returns a stable unique id for a row.
     * Required: selection, editing and keyed rendering need identity.
     */
    getRowId: (row: TRow) => string

    /** Feature modules to register. Order does not matter. */
    features?: GridFeature<TRow>[]

    /**
     * Row density. Drives row height and cell padding via CSS variables.
     * @default 'standard'
     */
    density?: Density

    /**
     * Where filtering, sorting and windowing happen.
     *
     * `'server'` makes those pipeline stages pass their rows through
     * untouched, because `data` already holds exactly what should be shown.
     * The features stay registered: their state, UI and events are what a
     * server row model listens to in order to fetch the next page.
     *
     * @default 'client'
     */
    rowModel?: RowModel

    /**
     * Languages the grid may use. It picks one from `locale`, or from the
     * page's own language when that is not set, so an app that imports a pack
     * is translated without configuring anything else.
     *
     * Only what is imported ends up in the bundle: the grid cannot reach for a
     * language it was never handed.
     */
    locales?: DataGridLocalePack[]

    /**
     * BCP-47 tag forcing one of `locales`, e.g. `'vi-VN'`. Leave it out to
     * follow the page. It is also what number, currency and date columns
     * format against, so one setting covers wording and formatting alike.
     *
     * Settable later through `grid.locale` to switch language in place.
     */
    locale?: string

    /**
     * Overrides on top of the chosen language — a term this app words its own
     * way. Any subset; the rest come from the language.
     */
    labels?: DataGridLabelsInput

    /** The same, for what the announcer says. */
    announcer?: Partial<DataGridAnnouncerStrings>

    /**
     * Classes added to every row — the escape hatch for data-driven row
     * styling such as flagging overdue records. Runs per rendered row.
     */
    rowClass?: (node: RowNode<TRow>) => ClassNameValue
}
