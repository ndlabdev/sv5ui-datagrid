import type { ColumnDef, ColumnState } from './types.js'

const DEFAULT_MIN_WIDTH = 40

export function createColumnState<TRow>(def: ColumnDef<TRow>): ColumnState<TRow> {
    return {
        id: def.id,
        def,
        header: def.header ?? def.id,
        width: def.width,
        flex: def.flex,
        minWidth: def.minWidth ?? DEFAULT_MIN_WIDTH,
        maxWidth: def.maxWidth,
        hidden: def.hidden ?? false,
        align: def.align ?? 'left',
        cssVar: `--dg-col-${sanitizeId(def.id)}-w`
    }
}

export function columnTrackSize<TRow>(column: ColumnState<TRow>): string {
    if (column.width !== undefined) {
        return `${clamp(column.width, column.minWidth, column.maxWidth)}px`
    }
    return `minmax(${column.minWidth}px, ${column.flex ?? 1}fr)`
}

export function buildColumnCssVars<TRow>(visible: ColumnState<TRow>[]): Record<string, string> {
    const vars: Record<string, string> = {}
    for (const column of visible) {
        vars[column.cssVar] = columnTrackSize(column)
    }
    vars['--dg-grid-template'] = visible.map((column) => `var(${column.cssVar})`).join(' ')
    return vars
}

export function toStyleString(vars: Record<string, string>): string {
    return Object.entries(vars)
        .map(([name, value]) => `${name}: ${value}`)
        .join('; ')
}

function clamp(value: number, min: number, max?: number): number {
    return Math.min(Math.max(value, min), max ?? Number.POSITIVE_INFINITY)
}

function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '-')
}
