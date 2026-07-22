import type { RowNode } from '../../core/types/index.js'
import type { SelectAllState } from './selection.types.js'

export function emptySelection(): ReadonlySet<string> {
    return new Set()
}

export function singleSelection(id: string): ReadonlySet<string> {
    return new Set([id])
}

export function withId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
    const next = new Set(set)
    next.add(id)
    return next
}

export function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
    const next = new Set(set)
    next.delete(id)
    return next
}

export function withRange(
    set: ReadonlySet<string>,
    orderedIds: string[],
    anchorId: string,
    targetId: string
): ReadonlySet<string> {
    const anchor = orderedIds.indexOf(anchorId)
    const target = orderedIds.indexOf(targetId)
    if (anchor < 0 || target < 0) return withId(set, targetId)

    const next = new Set(set)
    const start = Math.min(anchor, target)
    const end = Math.max(anchor, target)
    for (let index = start; index <= end; index++) {
        next.add(orderedIds[index])
    }
    return next
}

export function allSelection(ids: string[]): ReadonlySet<string> {
    return new Set(ids)
}

/**
 * The selectable ids as a set for membership tests. Rebuilt whole by the
 * derived that owns it and never mutated.
 */
export function selectableIdsOf<TRow>(nodes: RowNode<TRow>[]): ReadonlySet<string> {
    return new Set(nodes.map((node) => node.id))
}

/**
 * Counts the selection against the selectable ids rather than the other way
 * round: the header checkbox re-reads this on every toggle, and a selection is
 * normally far smaller than the row set it is drawn from.
 */
export function selectAllStateOf(
    set: ReadonlySet<string>,
    selectableIds: ReadonlySet<string>
): SelectAllState {
    if (selectableIds.size === 0 || set.size === 0) return 'none'
    let selected = 0
    for (const id of set) {
        if (selectableIds.has(id)) selected++
    }
    if (selected === 0) return 'none'
    return selected === selectableIds.size ? 'all' : 'some'
}
