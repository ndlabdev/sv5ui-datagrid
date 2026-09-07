import { type GridState } from '../../core/grid/index.js'
import {
    type CellValuePurpose,
    type CellValueReader,
    type ColumnDef,
    type GridFeature,
    type RowNode
} from '../../core/types/index.js'
import { applyMask, idSet } from './masks.js'
import type { PolicyContext, PolicyOptions, PolicyRule } from './policy.types.js'

const POLICY = 'policy'

const EVERY_PURPOSE: CellValuePurpose[] = [
    'render',
    'export',
    'clipboard',
    'search',
    'facet',
    'edit'
]

export class Policy<TRow> {
    #grid: GridState<TRow>
    #options: PolicyOptions<TRow>
    #warned = false

    constructor(grid: GridState<TRow>, options: PolicyOptions<TRow>) {
        this.#grid = grid
        this.#options = options
    }

    get rules(): PolicyRule<TRow>[] {
        return this.#options.rules
    }

    get guarded(): string[] {
        const ids = idSet(this.#options.rules.flatMap((rule) => rule.columns))
        return ids.filter((columnId) => {
            const def = this.#grid.columns.get(columnId)?.def
            return def ? !this.#options.except?.(def) : true
        })
    }

    isGuarded = (columnId: string): boolean => this.guarded.includes(columnId)

    #rulesFor(columnId: string, purpose: CellValuePurpose): PolicyRule<TRow>[] {
        const def = this.#grid.columns.get(columnId)?.def
        if (def && this.#options.except?.(def)) return []

        return this.#options.rules.filter(
            (rule) =>
                rule.columns.includes(columnId) &&
                (rule.purposes ?? EVERY_PURPOSE).includes(purpose)
        )
    }

    valueFor = (
        value: unknown,
        row: TRow | null,
        columnId: string,
        purpose: CellValuePurpose
    ): unknown => {
        const context: PolicyContext<TRow> = { row, columnId, purpose }

        let answer = value
        for (const rule of this.#rulesFor(columnId, purpose)) {
            if (rule.when && !rule.when(context)) continue
            answer =
                typeof rule.mask === 'function'
                    ? rule.mask(answer, context)
                    : applyMask(rule.mask, answer)
        }
        return answer
    }

    reader = (columnId: string, purpose: CellValuePurpose): CellValueReader<TRow> | undefined => {
        if (this.#rulesFor(columnId, purpose).length === 0) return undefined

        return (value: unknown, node: RowNode<TRow>) =>
            this.valueFor(value, node?.row ?? null, columnId, purpose)
    }

    readValue = (row: TRow, column: ColumnDef<TRow>): unknown => {
        const raw = column.accessor
            ? column.accessor(row)
            : (row as Record<string, unknown>)[column.id]
        return this.valueFor(raw, row, column.id, 'search')
    }

    warnOnOpenDoors = (): void => {
        if (this.#warned || this.#options.warnOnOpenDoors === false) return

        const open = this.guarded.filter((columnId) => {
            const def = this.#grid.columns.get(columnId)?.def
            return def ? def.sortable === true || def.filter !== undefined : false
        })
        if (open.length === 0) return

        this.#warned = true
        // eslint-disable-next-line no-console
        console.warn(
            `policy(): ${open.join(', ')} are masked but still sortable or filterable by the ` +
                "grid's own sort and column filters, which read the real value. A hidden number " +
                'is still rankable, and a filter narrowed enough is a search for it. Set ' +
                'sortable: false and filter: false on those columns until the grid can gate ' +
                'both, or pass warnOnOpenDoors: false if the ranking is not a secret.'
        )
    }
}

export function getPolicy<TRow>(grid: GridState<TRow>): Policy<TRow> | undefined {
    return grid.feature<Policy<TRow>>(POLICY)
}

export function policy<TRow>(options: PolicyOptions<TRow>): GridFeature<TRow> {
    return {
        id: POLICY,
        createState: (grid) => new Policy<TRow>(grid, options),
        cellValue: ({ grid, column, purpose }) => {
            const state = getPolicy(grid)
            state?.warnOnOpenDoors()
            return state?.reader(column.id, purpose)
        }
    }
}
