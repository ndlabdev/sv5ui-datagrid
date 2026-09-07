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

export function nodesById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, RowNode<TRow>> {
    const index = new Map<string, RowNode<TRow>>()
    for (const node of nodes) index.set(node.id, node)
    if (index.size !== nodes.length && import.meta.env?.DEV) warnDuplicateIds(nodes, index.size)
    return index
}

export function nodeIndexById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, number> {
    const positions = new Map<string, number>()
    for (let i = 0; i < nodes.length; i++) positions.set(nodes[i].id, i)
    return positions
}

export const LOADING_KEY = '__dgLoading'

const SYNTHETIC_KEY = '__dgSynthetic'

export function isLoadingRow(row: unknown): boolean {
    return Boolean((row as Record<string, unknown> | null)?.[LOADING_KEY])
}

export function isSyntheticRow(row: unknown): boolean {
    return Boolean((row as Record<string, unknown> | null)?.[SYNTHETIC_KEY])
}

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
