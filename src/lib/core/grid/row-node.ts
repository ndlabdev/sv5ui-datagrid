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

/**
 * Two rows sharing an id is the app's bug, but the grid fails at it silently
 * and in the worst possible way: the map keeps the last row for an id, and an
 * edit addressed to the row the user opened is written to the other one. Said
 * out loud in development, where it is cheap, rather than left to be found in
 * the data later.
 *
 * Repeated on every rebuild on purpose. Nothing here remembers what it already
 * reported, so no state outlives a grid, and the data stays wrong until it is
 * fixed.
 */
function warnDuplicateIds<TRow>(nodes: RowNode<TRow>[], unique: number): void {
    const seen = new Set<string>()
    const repeated = new Set<string>()
    for (const node of nodes) {
        if (seen.has(node.id)) repeated.add(node.id)
        else seen.add(node.id)
    }

    const shown = [...repeated].slice(0, DUPLICATES_SHOWN).join(', ')
    const rest = repeated.size - DUPLICATES_SHOWN
    // The one console statement in the library. A silent wrong write is worse
    // than a line in a development console, and there is no other channel: the
    // grid has no logger, and an error would take down an app over data it can
    // still draw.
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
    // The whole check, in production: one integer against another. Working out
    // which ids collided costs a second pass, and only a build that will print
    // it pays for that.
    if (index.size !== nodes.length && import.meta.env?.DEV) warnDuplicateIds(nodes, index.size)
    return index
}

/** Position of each row within the given list, which is not `node.index`. */
export function nodeIndexById<TRow>(nodes: RowNode<TRow>[]): ReadonlyMap<string, number> {
    const positions = new Map<string, number>()
    for (let i = 0; i < nodes.length; i++) positions.set(nodes[i].id, i)
    return positions
}
