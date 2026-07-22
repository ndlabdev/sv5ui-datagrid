import type {
    ColumnFilter,
    DateFilterOp,
    FilterType,
    NumberFilterOp,
    SetFilterValue,
    TextFilterOp
} from '../../core/types/index.js'

export interface FilterDraft {
    op: string
    value: string
    to: string
    boolValue: string
    setSelected: SetFilterValue[]
}

export function emptyDraft(type: FilterType): FilterDraft {
    return {
        op: type === 'text' ? 'contains' : type === 'number' ? 'eq' : 'equals',
        value: '',
        to: '',
        boolValue: 'true',
        setSelected: []
    }
}

const numToStr = (value: number | undefined): string => (value !== undefined ? String(value) : '')

// sv5ui Input type="number" binds a number, so drafts may hold non-strings.
const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

export function draftFromFilter(type: FilterType, filter: ColumnFilter | undefined): FilterDraft {
    const draft = emptyDraft(type)
    if (!filter) return draft

    if (filter.kind === 'text') return { ...draft, op: filter.op, value: filter.value }
    if (filter.kind === 'number') {
        return { ...draft, op: filter.op, value: numToStr(filter.value), to: numToStr(filter.to) }
    }
    if (filter.kind === 'date') {
        return { ...draft, op: filter.op, value: filter.value ?? '', to: filter.to ?? '' }
    }
    if (filter.kind === 'set') return { ...draft, setSelected: [...filter.values] }
    return { ...draft, boolValue: filter.value ? 'true' : 'false' }
}

function buildNumber(draft: FilterDraft): ColumnFilter | null {
    if (draft.op === 'blank') return { kind: 'number', op: 'blank' }
    const value = str(draft.value)
    const parsed = Number(value)
    if (value.trim() === '' || Number.isNaN(parsed)) return null
    if (draft.op === 'between') {
        const to = str(draft.to)
        const parsedTo = Number(to)
        if (to.trim() === '' || Number.isNaN(parsedTo)) return null
        return { kind: 'number', op: 'between', value: parsed, to: parsedTo }
    }
    return { kind: 'number', op: draft.op as NumberFilterOp, value: parsed }
}

function buildDate(draft: FilterDraft): ColumnFilter | null {
    const value = str(draft.value)
    if (value === '') return null
    if (draft.op === 'between') {
        const to = str(draft.to)
        return to === '' ? null : { kind: 'date', op: 'between', value, to }
    }
    return { kind: 'date', op: draft.op as DateFilterOp, value }
}

export function buildColumnFilter(type: FilterType, draft: FilterDraft): ColumnFilter | null {
    switch (type) {
        case 'text':
            if (draft.op !== 'blank' && str(draft.value).trim() === '') return null
            return { kind: 'text', op: draft.op as TextFilterOp, value: str(draft.value) }
        case 'number':
            return buildNumber(draft)
        case 'date':
            return buildDate(draft)
        case 'set':
            return draft.setSelected.length > 0 ? { kind: 'set', values: draft.setSelected } : null
        case 'boolean':
            return { kind: 'boolean', value: draft.boolValue === 'true' }
    }
}
