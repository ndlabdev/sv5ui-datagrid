import { gateReader, type GridState, PIPELINE_ORDER } from '../../core/grid/index.js'
import { type GridFeature, type RowNode } from '../../core/types/index.js'
import { getGrouping } from '../grouping/index.js'
import { applyShares } from './shares.js'
import type { ShowAs, ShowValuesAsOptions } from './show-values-as.types.js'

const SHOW_VALUES_AS = 'showValuesAs'

const SHOW_VALUES_AS_ORDER = PIPELINE_ORDER.group + 1

const SERVER_SKIP =
    'showValuesAs() skips percentOfGrandTotal and percentOfParent on rowModel: "server": each ' +
    'divides by a total over the whole column, and the client only holds the blocks it has ' +
    'loaded, so the share would change under the user as they scroll. percentOfRow still ' +
    'runs - it reads one row at a time. getShowValuesAs(grid).skippedColumns lists what was ' +
    'skipped.'

const missingAggregation = (columnId: string): string =>
    `showValuesAs: "${columnId}" is shown as percentOfParent, but grouping() has no ` +
    'aggregation for it, so the group row it divides by holds nothing and the column ' +
    `reads blank. Add it: grouping({ aggregations: { ${columnId}: 'sum' } }).`

function readShown(slice: unknown): Record<string, ShowAs> | null {
    if (slice === null || typeof slice !== 'object' || Array.isArray(slice)) return null

    const out: Record<string, ShowAs> = {}
    for (const [id, entry] of Object.entries(slice as Record<string, unknown>)) {
        if (entry === 'percentOfGrandTotal' || entry === 'percentOfParent') {
            out[id] = entry
            continue
        }
        const shape = entry as { kind?: unknown; of?: unknown }
        if (shape?.kind !== 'percentOfRow' || !Array.isArray(shape.of)) continue
        out[id] = { kind: 'percentOfRow', of: shape.of.filter((of) => typeof of === 'string') }
    }
    return out
}

export class ShowValuesAs<TRow> {
    shown = $state.raw<Record<string, ShowAs>>({})

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: ShowValuesAsOptions) {
        this.#grid = grid
        this.shown = options.columns ?? {}
    }

    showAsFor = (columnId: string): ShowAs | undefined => this.shown[columnId]

    set = (columnId: string, showAs: ShowAs | null): void => {
        const next = { ...this.shown }
        if (showAs === null) delete next[columnId]
        else next[columnId] = showAs
        this.shown = next
    }

    clear = (): void => {
        this.shown = {}
    }

    #warnedParent: string[] = []

    #warnMissingAggregation(): void {
        const grouping = getGrouping(this.#grid)
        if (!grouping || grouping.by.length === 0) return

        for (const [columnId, showAs] of Object.entries(this.shown)) {
            if (showAs !== 'percentOfParent') continue
            if (grouping.aggregations[columnId] !== undefined) continue
            if (this.#warnedParent.includes(columnId)) continue

            this.#warnedParent.push(columnId)
            // eslint-disable-next-line no-console
            console.warn(missingAggregation(columnId))
        }
    }

    get skippedColumns(): readonly string[] {
        if (this.#grid.rowModel !== 'server') return []
        return Object.entries(this.shown)
            .filter(([, showAs]) => typeof showAs === 'string')
            .map(([columnId]) => columnId)
    }

    #warnedServer = false

    #shownHere(): Record<string, ShowAs> {
        if (this.#grid.rowModel !== 'server') return this.shown

        const kept: Record<string, ShowAs> = {}
        let skipped = false
        for (const [columnId, showAs] of Object.entries(this.shown)) {
            if (typeof showAs === 'string') skipped = true
            else kept[columnId] = showAs
        }
        if (skipped && !this.#warnedServer) {
            this.#warnedServer = true
            // eslint-disable-next-line no-console
            console.warn(SERVER_SKIP)
        }
        return kept
    }

    apply = (nodes: RowNode<TRow>[]): RowNode<TRow>[] => {
        this.#warnMissingAggregation()
        return applyShares(nodes, {
            shown: this.#shownHere(),
            columns: this.#grid.columns.all.map((column) => column.def),
            read: gateReader(this.#grid, 'render')
        })
    }

    serialize = (): Record<string, ShowAs> | undefined =>
        Object.keys(this.shown).length === 0 ? undefined : this.shown

    hydrate = (slice: unknown): void => {
        const next = readShown(slice)
        if (next) this.shown = next
    }
}

export function getShowValuesAs<TRow>(grid: GridState<TRow>): ShowValuesAs<TRow> | undefined {
    return grid.feature<ShowValuesAs<TRow>>(SHOW_VALUES_AS)
}

export function showValuesAs<TRow>(options: ShowValuesAsOptions = {}): GridFeature<TRow> {
    return {
        id: SHOW_VALUES_AS,
        createState: (grid) => new ShowValuesAs(grid, options),
        createApi: (grid) => {
            const state = getShowValuesAs(grid)!
            return {
                setShowValuesAs: (columnId: string, showAs: unknown) =>
                    state.set(columnId, showAs as ShowAs | null),
                showValuesAsFor: state.showAsFor,
                clearShowValuesAs: state.clear
            }
        },
        pipelineStage: {
            order: SHOW_VALUES_AS_ORDER,
            transform: (nodes, grid) => getShowValuesAs(grid)?.apply(nodes) ?? nodes
        },
        serialize: (grid) => getShowValuesAs(grid)?.serialize(),
        hydrate: (slice, grid) => getShowValuesAs(grid)?.hydrate(slice)
    }
}

declare module '../../core/types/api.js' {
    interface GridApi {
        setShowValuesAs?: (columnId: string, showAs: unknown) => void
        showValuesAsFor?: (columnId: string) => unknown
        clearShowValuesAs?: () => void
    }
}
