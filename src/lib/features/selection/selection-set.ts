import { idSetWith as withId, idSetWithout as withoutId } from '../../core/utils/index.js'
import type { RowNode } from '../../core/types/index.js'
import type { SelectAllState } from './selection.types.js'

export { withId, withoutId }

export function emptySelection(): ReadonlySet<string> {
    return new Set()
}

export function singleSelection(id: string): ReadonlySet<string> {
    return new Set([id])
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

export function withIds(set: ReadonlySet<string>, ids: Iterable<string>): ReadonlySet<string> {
    const next = new Set(set)
    for (const id of ids) next.add(id)
    return next
}

export function withoutIds(set: ReadonlySet<string>, ids: Iterable<string>): ReadonlySet<string> {
    const next = new Set(set)
    for (const id of ids) next.delete(id)
    return next
}

export function selectableIdsOf<TRow>(nodes: RowNode<TRow>[]): ReadonlySet<string> {
    return new Set(nodes.map((node) => node.id))
}

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
