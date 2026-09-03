import type {
    ColumnFilter,
    ColumnFilterEntry,
    DateFilterOp,
    FilterModel,
    NumberFilterOp,
    SetFilterValue,
    TextFilterOp
} from '../../core/types/index.js'

/**
 * A snapshot is not a `FilterModel` just because it was cast to one. Share
 * links, `localStorage` and anything handed back to `setState` have all been
 * outside the grid, and a filter whose operator or value does not match its
 * kind reaches the predicate builders as a shape they never check. That threw
 * inside the pipeline's `$derived`, which takes down the render pass rather
 * than one column.
 *
 * So the boundary drops what it cannot read. A condition that fails to
 * sanitize is left out; a column left with nothing is left out; a model with
 * no readable column filters nothing, which is what an empty model already
 * does. That shows more rows than the snapshot asked for, deliberately: it is
 * the honest reading of a filter nobody can reconstruct, and the alternative
 * measured here was a grid that would not render at all.
 */

const TEXT_OPS = new Set<string>([
    'contains',
    'notContains',
    'equals',
    'notEqual',
    'startsWith',
    'endsWith',
    'blank',
    'notBlank'
])
const NUMBER_OPS = new Set<string>([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'blank',
    'notBlank'
])
const DATE_OPS = new Set<string>(['equals', 'before', 'after', 'between', 'blank', 'notBlank'])
const PRESENCE_OPS = new Set<string>(['blank', 'notBlank'])

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function opOf(raw: Record<string, unknown>, allowed: Set<string>): string | null {
    const { op } = raw
    return typeof op === 'string' && allowed.has(op) ? op : null
}

function isSetValue(value: unknown): value is SetFilterValue {
    return (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    )
}

function sanitizeText(raw: Record<string, unknown>): ColumnFilter | null {
    const op = opOf(raw, TEXT_OPS)
    if (op === null) return null
    // The presence operators carry no value, and the editor writes them with
    // an empty one, so both spellings have to hydrate.
    if (PRESENCE_OPS.has(op)) return { kind: 'text', op: op as TextFilterOp, value: '' }
    if (typeof raw.value !== 'string') return null
    const filter: Extract<ColumnFilter, { kind: 'text' }> = {
        kind: 'text',
        op: op as TextFilterOp,
        value: raw.value
    }
    if (raw.caseSensitive === true) filter.caseSensitive = true
    return filter
}

function sanitizeNumber(raw: Record<string, unknown>): ColumnFilter | null {
    const op = opOf(raw, NUMBER_OPS)
    if (op === null) return null
    if (PRESENCE_OPS.has(op)) return { kind: 'number', op: op as NumberFilterOp }
    if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) return null
    if (op === 'between') {
        if (typeof raw.to !== 'number' || !Number.isFinite(raw.to)) return null
        return { kind: 'number', op: 'between', value: raw.value, to: raw.to }
    }
    return { kind: 'number', op: op as NumberFilterOp, value: raw.value }
}

function sanitizeDate(raw: Record<string, unknown>): ColumnFilter | null {
    const op = opOf(raw, DATE_OPS)
    if (op === null) return null
    if (PRESENCE_OPS.has(op)) return { kind: 'date', op: op as DateFilterOp }
    if (typeof raw.value !== 'string' || raw.value === '') return null
    if (op === 'between') {
        if (typeof raw.to !== 'string' || raw.to === '') return null
        return { kind: 'date', op: 'between', value: raw.value, to: raw.to }
    }
    return { kind: 'date', op: op as DateFilterOp, value: raw.value }
}

function sanitizeSet(raw: Record<string, unknown>): ColumnFilter | null {
    if (!Array.isArray(raw.values)) return null
    const values = raw.values.filter(isSetValue)
    // The editor never builds an empty selection, so an empty one here is the
    // remains of a broken list rather than a request to match nothing.
    return values.length > 0 ? { kind: 'set', values } : null
}

function sanitizeCondition(raw: unknown): ColumnFilter | null {
    if (!isRecord(raw)) return null
    switch (raw.kind) {
        case 'text':
            return sanitizeText(raw)
        case 'number':
            return sanitizeNumber(raw)
        case 'date':
            return sanitizeDate(raw)
        case 'set':
            return sanitizeSet(raw)
        case 'boolean':
            return typeof raw.value === 'boolean' ? { kind: 'boolean', value: raw.value } : null
        default:
            return null
    }
}

function sanitizeEntry(raw: unknown): ColumnFilterEntry | null {
    if (!isRecord(raw)) return null
    if (raw.kind !== 'group') return sanitizeCondition(raw)
    if (!Array.isArray(raw.conditions)) return null
    const conditions = raw.conditions
        .map((condition) => sanitizeCondition(condition))
        .filter((condition): condition is ColumnFilter => condition !== null)
    if (conditions.length === 0) return null
    return { kind: 'group', join: raw.join === 'or' ? 'or' : 'and', conditions }
}

/** A model built only from what the snapshot got right; null if it got nothing right. */
export function sanitizeFilterModel(slice: unknown): FilterModel | null {
    if (!isRecord(slice)) return null

    const columns: Record<string, ColumnFilterEntry> = {}
    if (isRecord(slice.columns)) {
        for (const [columnId, entry] of Object.entries(slice.columns)) {
            const clean = sanitizeEntry(entry)
            if (clean !== null) columns[columnId] = clean
        }
    }

    return { quick: typeof slice.quick === 'string' ? slice.quick : '', columns }
}
