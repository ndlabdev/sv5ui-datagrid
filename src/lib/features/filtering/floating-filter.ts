import type {
    ColumnFilter,
    ColumnFilterEntry,
    FilterType,
    SetFilterValue
} from '../../core/types/index.js'
import { emptyCondition, isPresenceOp } from './filter-draft.js'
import { toDisplayUnit } from './filter-units.js'

type FloatingCell =
    | { kind: 'none' }
    | { kind: 'input'; op: string; value: string; caseSensitive: boolean }
    | { kind: 'boolean'; value: '' | 'true' | 'false' }
    | { kind: 'set'; values: SetFilterValue[] }
    | { kind: 'summary' }

function simple(filter: ColumnFilter, scale: number): FloatingCell | null {
    if (filter.kind === 'text') {
        return {
            kind: 'input',
            op: filter.op,
            value: filter.value,
            caseSensitive: filter.caseSensitive === true
        }
    }
    if (filter.kind === 'number') {
        if (filter.value === undefined) return null
        const shown = toDisplayUnit(filter.value, scale)
        return { kind: 'input', op: filter.op, value: String(shown), caseSensitive: false }
    }
    if (filter.kind === 'date') {
        return { kind: 'input', op: filter.op, value: filter.value ?? '', caseSensitive: false }
    }
    return null
}

function booleanCell(entry: ColumnFilterEntry | undefined): FloatingCell {
    if (entry?.kind !== 'boolean') return { kind: 'boolean', value: '' }
    return { kind: 'boolean', value: entry.value ? 'true' : 'false' }
}

function setCell(entry: ColumnFilterEntry | undefined): FloatingCell {
    if (entry === undefined) return { kind: 'set', values: [] }
    return entry.kind === 'set' ? { kind: 'set', values: entry.values } : { kind: 'summary' }
}

function panelOnly(filter: ColumnFilter): boolean {
    return 'op' in filter && (filter.op === 'between' || isPresenceOp(filter.op))
}

export function floatingCellOf(
    type: FilterType | null,
    entry: ColumnFilterEntry | undefined,
    scale = 1
): FloatingCell {
    if (type === null) return { kind: 'none' }
    if (type === 'set') return setCell(entry)
    if (type === 'boolean') return booleanCell(entry)

    if (entry === undefined) {
        return { kind: 'input', op: emptyCondition(type).op, value: '', caseSensitive: false }
    }
    if (entry.kind === 'group' || panelOnly(entry)) return { kind: 'summary' }
    return simple(entry, scale) ?? { kind: 'summary' }
}
