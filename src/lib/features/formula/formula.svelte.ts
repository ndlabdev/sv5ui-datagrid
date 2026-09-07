import { type GridState } from '../../core/grid/index.js'
import { type GridFeature, type RowNode } from '../../core/types/index.js'
import {
    applyFormulas,
    compileAll,
    compileExpressions,
    expressionsOf,
    NO_FORMULAS,
    withEntry,
    withoutEntry,
    type CompiledMap,
    type ParseFailure,
    type ReportParseError
} from './compiled.js'
import type { FormulaColumn, FormulaOptions } from './formula.types.js'

const FORMULA = 'formula'

const FORMULA_ORDER = 50

const COMPUTED = Object.freeze({})

const refuseEditing = (): unknown => COMPUTED

export class Formula<TRow> {
    #grid: GridState<TRow>
    #report: ReportParseError

    #compiled = $state.raw<CompiledMap>(NO_FORMULAS)

    constructor(grid: GridState<TRow>, options: FormulaOptions) {
        this.#grid = grid
        this.#report = (columnId, failure) =>
            options.onParseError?.(columnId, failure.message, failure.at)

        this.#compiled = compileAll(options.columns ?? {}, this.#report)
    }

    get columnIds(): string[] {
        return [...this.#compiled.keys()]
    }

    expressionOf = (columnId: string): string | undefined =>
        this.#compiled.get(columnId)?.expression

    errorOf = (columnId: string): ParseFailure | null => this.#compiled.get(columnId)?.error ?? null

    isFormulaColumn = (columnId: string): boolean => this.#compiled.has(columnId)

    set = (columnId: string, entry: string | FormulaColumn): void => {
        this.#compiled = withEntry(this.#compiled, columnId, entry, this.#report)
    }

    remove = (columnId: string): void => {
        this.#compiled = withoutEntry(this.#compiled, columnId)
    }

    clear = (): void => {
        this.#compiled = NO_FORMULAS
    }

    apply = (nodes: RowNode<TRow>[]): RowNode<TRow>[] =>
        applyFormulas(nodes, this.#compiled, this.#grid.columns.all, this.#grid)

    serialize = (): Record<string, string> | undefined =>
        this.#compiled.size === 0 ? undefined : expressionsOf(this.#compiled)

    hydrate = (slice: unknown): void => {
        const next = compileExpressions(slice, this.#report)
        if (next) this.#compiled = next
    }
}

export function formula<TRow>(options: FormulaOptions = {}): GridFeature<TRow> {
    return {
        id: FORMULA,
        createState: (grid) => new Formula(grid, options),
        pipelineStage: {
            order: FORMULA_ORDER,
            transform: (nodes, grid) => getFormula(grid)?.apply(nodes) ?? nodes
        },
        createApi: (grid) => {
            const state = getFormula(grid)!
            return {
                setFormula: state.set,
                removeFormula: state.remove,
                formulaFor: state.expressionOf
            }
        },
        cellValue: ({ grid, column, purpose }) =>
            purpose === 'edit' && getFormula(grid)?.isFormulaColumn(column.id)
                ? refuseEditing
                : undefined,
        serialize: (grid) => getFormula(grid)?.serialize(),
        hydrate: (slice, grid) => getFormula(grid)?.hydrate(slice)
    }
}

export function getFormula<TRow>(grid: GridState<TRow>): Formula<TRow> | undefined {
    return grid.feature<Formula<TRow>>(FORMULA)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        setFormula?: (columnId: string, entry: string) => void
        removeFormula?: (columnId: string) => void
        formulaFor?: (columnId: string) => string | undefined
    }
}
