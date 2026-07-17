import { clamp } from './math.js'
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

export function buildColumnCssVars<TRow>(
    visible: ColumnState<TRow>[],
    resolvedWidths?: number[] | null
): Record<string, string> {
    const vars: Record<string, string> = {}
    visible.forEach((column, index) => {
        vars[column.cssVar] = resolvedWidths
            ? `${resolvedWidths[index]}px`
            : columnTrackSize(column)
    })
    vars['--dg-grid-template'] = visible.map((column) => `var(${column.cssVar})`).join(' ')
    return vars
}

export function resolveColumnWidths<TRow>(
    columns: ColumnState<TRow>[],
    containerWidth: number
): number[] {
    const widths = columns.map((column) =>
        column.width !== undefined ? clamp(column.width, column.minWidth, column.maxWidth) : 0
    )

    const fixedSum = widths.reduce((sum, width) => sum + width, 0)
    let remaining = Math.max(0, containerWidth - fixedSum)
    let active = columns.flatMap((column, index) => (column.width === undefined ? [index] : []))

    while (active.length > 0) {
        const totalFlex = active.reduce((sum, index) => sum + (columns[index].flex ?? 1), 0)
        let pinned = -1

        for (const index of active) {
            const share = (remaining * (columns[index].flex ?? 1)) / totalFlex
            const max = columns[index].maxWidth ?? Number.POSITIVE_INFINITY
            if (share < columns[index].minWidth || share > max) {
                widths[index] = clamp(share, columns[index].minWidth, columns[index].maxWidth)
                remaining = Math.max(0, remaining - widths[index])
                pinned = index
                break
            }
        }

        if (pinned >= 0) {
            active = active.filter((index) => index !== pinned)
            continue
        }

        for (const index of active) {
            widths[index] = (remaining * (columns[index].flex ?? 1)) / totalFlex
        }
        break
    }

    return widths.map((width) => Math.round(width * 100) / 100)
}

export function prefixSums(widths: number[]): number[] {
    const offsets = new Array<number>(widths.length + 1)
    offsets[0] = 0
    for (let i = 0; i < widths.length; i++) {
        offsets[i + 1] = offsets[i] + widths[i]
    }
    return offsets
}

export function toStyleString(vars: Record<string, string>): string {
    return Object.entries(vars)
        .map(([name, value]) => `${name}: ${value}`)
        .join('; ')
}

function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '-')
}
