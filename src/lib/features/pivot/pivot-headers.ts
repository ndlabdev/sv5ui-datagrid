import { formatCellText, isBlank } from '../../core/utils/index.js'
import type { ColumnDef } from '../../core/types/index.js'
import type { PivotMeasure } from './pivot.types.js'

export type HeaderText = (key: string, depth: number, value: unknown) => string

export function defaultHeader<TRow>(
    fields: ColumnDef<TRow>[],
    locale: string | undefined,
    blank: string
): HeaderText {
    return (key, depth, value) => {
        if (isBlank(value)) return blank
        const column = fields[depth]
        if (!column) return key
        return formatCellText(value, column, locale) ?? key
    }
}

export const COUNTS = new Set(['count', 'distinctCount'])

export const KEEPS_UNIT = new Set(['runningTotal', 'differenceFrom'])

export function readingOf(showAs: string | undefined): 'measured' | 'plain' | 'percent' {
    if (showAs === undefined || KEEPS_UNIT.has(showAs)) return 'measured'
    return showAs === 'rankInRow' ? 'plain' : 'percent'
}

export function measuredLook<TRow>(
    measure: PivotMeasure<TRow>,
    source: ColumnDef<TRow> | undefined
): Partial<ColumnDef<TRow>> {
    if (!source) return {}

    const look: Partial<ColumnDef<TRow>> = {
        width: source.width,
        minWidth: source.minWidth,
        align: source.align ?? 'right'
    }

    if (measure.type !== undefined) return { ...look, type: measure.type }

    const read = readingOf(measure.showAs)
    if (read === 'plain') return look
    if (read === 'percent') return { ...look, type: 'percent' as const }

    const agg = measure.agg
    if (measure.per !== undefined || typeof agg !== 'string' || COUNTS.has(agg)) return look

    return { ...look, type: source.type, typeOptions: source.typeOptions, cell: source.cell }
}
