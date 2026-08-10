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
 * A versioned JSON view of everything the user can rearrange. Identity is by
 * column id, so unknown ids are dropped and new ones keep their defaults.
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
 * Restores from `localStorage` before the first client paint. SSR cannot read
 * it, so an SSR'd grid paints defaults and corrects after hydration — render
 * a persisted grid client-side to avoid the flash.
 */
export interface PersistStateOptions {
    /** localStorage key. */
    key: string
    /** Upgrades an older snapshot; undefined discards it. */
    migrate?: (stored: GridSnapshot) => GridSnapshot | undefined
}

/** Typed event map of the grid event bus. Features and later phases extend this surface. */
export interface GridEventMap {
    sortChanged: { sort: SortState[] }
    filterChanged: { filter: FilterModel }
    pageChanged: { page: number; pageSize: number | null }
    /** The server's total changed under `rowModel: 'server'`. */
    rowCountChanged: { total: number }
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

    /** A stable unique id; selection, editing and keyed rendering need it. */
    getRowId: (row: TRow) => string

    /** Feature modules to register. Order does not matter. */
    features?: GridFeature<TRow>[]

    /**
     * Drives row height and cell padding through CSS variables.
     * @default 'standard'
     */
    density?: Density

    /**
     * Where filtering, sorting and windowing happen. `'server'` passes those
     * stages through untouched — `data` already holds what to show — while
     * the features stay registered as what a server model listens to.
     * @default 'client'
     */
    rowModel?: RowModel

    /**
     * Languages the grid may use, chosen from `locale` or the page's own.
     * Only what is imported ends up in the bundle.
     */
    locales?: DataGridLocalePack[]

    /**
     * BCP-47 tag forcing one of `locales`; omit to follow the page. Number,
     * currency and date columns format against it too. Settable later through
     * `grid.locale`.
     */
    locale?: string

    /** Overrides on top of the chosen language; any subset. */
    labels?: DataGridLabelsInput

    /** The same, for what the announcer says. */
    announcer?: Partial<DataGridAnnouncerStrings>

    /** Per-row classes. Runs per rendered row. */
    rowClass?: (node: RowNode<TRow>) => ClassNameValue
}
