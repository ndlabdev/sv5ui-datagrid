import type { RowNode } from '../types/index.js'

export function buildRowNodes<TRow>(
    data: TRow[],
    getRowId: (row: TRow) => string
): RowNode<TRow>[] {
    const nodes = new Array<RowNode<TRow>>(data.length)
    for (let index = 0; index < data.length; index++) {
        nodes[index] = { id: getRowId(data[index]), row: data[index], index }
    }
    return nodes
}

const DUPLICATES_SHOWN = 5

function warnDuplicateIds<TRow>(nodes: RowNode<TRow>[], unique: number): void {
    const seen = new Set<string>()
    const repeated = new Set<string>()
    for (const node of nodes) {
        if (seen.has(node.id)) repeated.add(node.id)
        else seen.add(node.id)
    }

    const shown = [...repeated].slice(0, DUPLICATES_SHOWN).join(', ')
    const rest = repeated.size - DUPLICATES_SHOWN
    // eslint-disable-next-line no-console
    console.warn(
        `[sv5ui-datagrid] getRowId returned the same id for more than one row: ${shown}` +
            (rest > 0 ? ` and ${rest} more` : '') +
            `. ${nodes.length} rows share ${unique} ids, so an edit or a selection meant for ` +
            'one of them will land on another. Give every row an id of its own.'
    )
}

/**
 * Rebuilt whole by the derived that owns it, so a plain Map suffices. Filled
 * by hand rather than from `map`, which would allocate a second array of pairs
 * the size of the data on the way in.
 */
export function nodesById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, RowNode<TRow>> {
    const index = new Map<string, RowNode<TRow>>()
    for (const node of nodes) index.set(node.id, node)
    if (index.size !== nodes.length && import.meta.env?.DEV) warnDuplicateIds(nodes, index.size)
    return index
}

/** Position of each row within the given list, which is not `node.index`. */
export function nodeIndexById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, number> {
    const positions = new Map<string, number>()
    for (let i = 0; i < nodes.length; i++) positions.set(nodes[i].id, i)
    return positions
}

/**
 * Not every row in the pipeline came from the data. A group header, a group
 * footer, a grand total and a placeholder waiting on a server all travel as
 * `RowNode`s so that layout, focus and virtualization need no special case for
 * them, and all four have to be excluded from the passes that read values: an
 * aggregate must not count its own subtotal, a fill must not overwrite a group
 * header, a find must not match a row that has not arrived yet.
 *
 * The marks live on the row object rather than on `meta` because they have to
 * survive being copied into a synthetic row by a feature that never saw the
 * node, and because `isLoadingRow` is asked about raw rows a data source
 * returned, before any node exists.
 */
export const LOADING_KEY = '__dgLoading'

export const SYNTHETIC_KEY = '__dgSynthetic'

export function isLoadingRow(row: unknown): boolean {
    return Boolean((row as Record<string, unknown> | null)?.[LOADING_KEY])
}

export function isSyntheticRow(row: unknown): boolean {
    return Boolean((row as Record<string, unknown> | null)?.[SYNTHETIC_KEY])
}

/** Marks a copy, never the row it was handed: the caller's row is the data. */
export function markSyntheticRow<TRow>(row: TRow): TRow {
    return { ...(row as object), [SYNTHETIC_KEY]: true } as TRow
}

/**
 * A node carrying real values from the data, which is what a feature reading
 * cells means by "a row". A full-width row is excluded even when its row is
 * real: it is drawn as one panel across the grid, so it has no cell to read.
 */
export function isDataRow<TRow>(node: RowNode<TRow>): boolean {
    return node.meta?.fullWidth !== true && !isSyntheticRow(node.row) && !isLoadingRow(node.row)
}
