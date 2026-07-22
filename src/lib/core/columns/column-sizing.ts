import { clamp } from '../utils/math.js'
import type { ColumnDef, ColumnState, PinnedSide } from '../types.js'

const DEFAULT_MIN_WIDTH = 40

export interface ColumnStateOverrides {
    width?: number
    hidden?: boolean
    pinned?: PinnedSide | null
}

function resolvePinned<TRow>(
    def: ColumnDef<TRow>,
    overrides: ColumnStateOverrides
): ColumnState<TRow>['pinned'] {
    if (overrides.pinned !== undefined) return overrides.pinned
    return def.pinned ?? null
}

export function createColumnState<TRow>(
    def: ColumnDef<TRow>,
    overrides: ColumnStateOverrides = {}
): ColumnState<TRow> {
    const width = overrides.width ?? def.width
    const sanitized = sanitizeId(def.id)
    return {
        id: def.id,
        def,
        header: def.header ?? def.id,
        width,
        flex: width !== undefined ? undefined : def.flex,
        minWidth: def.minWidth ?? DEFAULT_MIN_WIDTH,
        maxWidth: def.maxWidth,
        hidden: overrides.hidden ?? def.hidden ?? false,
        align: def.align ?? 'left',
        pinned: resolvePinned(def, overrides),
        cssVar: `--dg-col-${sanitized}-w`,
        pinVar: `--dg-col-${sanitized}-pin`
    }
}

export type WidthOverrides = Record<string, number>

function effectiveWidth<TRow>(
    column: ColumnState<TRow>,
    overrides: WidthOverrides
): number | undefined {
    return overrides[column.id] ?? column.width
}

export function columnTrackSize<TRow>(
    column: ColumnState<TRow>,
    overrides: WidthOverrides = {}
): string {
    const width = effectiveWidth(column, overrides)
    if (width !== undefined) {
        return `${clamp(width, column.minWidth, column.maxWidth)}px`
    }
    return `minmax(${column.minWidth}px, ${column.flex ?? 1}fr)`
}

export function trackWidthEstimates<TRow>(
    visible: ColumnState<TRow>[],
    resolvedWidths: number[] | null,
    overrides: WidthOverrides = {}
): number[] {
    if (resolvedWidths) return resolvedWidths
    return visible.map((column) => {
        const width = effectiveWidth(column, overrides)
        return width !== undefined
            ? clamp(width, column.minWidth, column.maxWidth)
            : column.minWidth
    })
}

export function pinOffsets<TRow>(
    visible: ColumnState<TRow>[],
    trackWidths: number[]
): Record<string, number> {
    const offsets: Record<string, number> = {}

    let left = 0
    for (let i = 0; i < visible.length; i++) {
        if (visible[i].pinned !== 'left') continue
        offsets[visible[i].id] = left
        left += trackWidths[i]
    }

    let right = 0
    for (let i = visible.length - 1; i >= 0; i--) {
        if (visible[i].pinned !== 'right') continue
        offsets[visible[i].id] = right
        right += trackWidths[i]
    }

    return offsets
}

export function buildColumnCssVars<TRow>(
    visible: ColumnState<TRow>[],
    resolvedWidths?: number[] | null,
    pins?: Record<string, number> | null,
    overrides: WidthOverrides = {}
): Record<string, string> {
    const vars: Record<string, string> = {}
    visible.forEach((column, index) => {
        vars[column.cssVar] = resolvedWidths
            ? `${resolvedWidths[index]}px`
            : columnTrackSize(column, overrides)
        if (column.pinned && pins) {
            vars[column.pinVar] = `${pins[column.id] ?? 0}px`
        }
    })
    vars['--dg-grid-template'] = visible.map((column) => `var(${column.cssVar})`).join(' ')
    return vars
}

function findConstrainedFlex<TRow>(
    columns: ColumnState<TRow>[],
    active: number[],
    remaining: number,
    totalFlex: number
): number {
    for (const index of active) {
        const share = (remaining * (columns[index].flex ?? 1)) / totalFlex
        const max = columns[index].maxWidth ?? Number.POSITIVE_INFINITY
        if (share < columns[index].minWidth || share > max) return index
    }
    return -1
}

export function resolveColumnWidths<TRow>(
    columns: ColumnState<TRow>[],
    containerWidth: number,
    overrides: WidthOverrides = {}
): number[] {
    const widths = columns.map((column) => {
        const width = effectiveWidth(column, overrides)
        return width !== undefined ? clamp(width, column.minWidth, column.maxWidth) : 0
    })

    const fixedSum = widths.reduce((sum, width) => sum + width, 0)
    let remaining = Math.max(0, containerWidth - fixedSum)
    let active = columns.flatMap((column, index) =>
        effectiveWidth(column, overrides) === undefined ? [index] : []
    )

    while (active.length > 0) {
        const totalFlex = active.reduce((sum, index) => sum + (columns[index].flex ?? 1), 0)
        const constrained = findConstrainedFlex(columns, active, remaining, totalFlex)

        if (constrained >= 0) {
            const column = columns[constrained]
            const share = (remaining * (column.flex ?? 1)) / totalFlex
            widths[constrained] = clamp(share, column.minWidth, column.maxWidth)
            remaining = Math.max(0, remaining - widths[constrained])
            active = active.filter((index) => index !== constrained)
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
