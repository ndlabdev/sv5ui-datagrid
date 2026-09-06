import {
    type CellRead,
    gateReader,
    type GridState,
    isDataRow,
    isLoadingRow
} from '../../core/grid/index.js'
import {
    type CellDecoration,
    type ColumnState,
    type GridFeature,
    type RowNode
} from '../../core/types/index.js'
import { slotClass } from '../../core/theme/index.js'
import type { ConditionalFormattingOptions, FormatRule } from './conditional-formatting.types.js'
import { isPainted, mergePaint, type Paint, type PaintContext, paintOf } from './paint.js'
import {
    appliesTo,
    compileRules,
    copyRules,
    NO_COMPILED,
    normalizeRules,
    ruleId,
    sanitizeRules,
    type CompiledRules,
    type ReportParseError,
    type RuleParseError
} from './rules.js'
import { columnMap, computeStats, dataRowsOf, type RuleStats } from './stats.js'

export const CONDITIONAL_FORMATTING = 'conditionalFormatting'

const SERVER_SKIP =
    'conditionalFormatting() skips colorScale, dataBar, topN and duplicates on ' +
    'rowModel: "server": each ranks a value against the whole column, and the client only holds ' +
    'the blocks it has loaded, so the paint would change under the user as they scroll. ' +
    'Expression rules still run - they read one row at a time. ' +
    'getConditionalFormatting(grid).skippedRules lists what was skipped.'

const NO_READ = (): undefined => undefined

export class ConditionalFormatting<TRow> {
    #grid: GridState<TRow>
    #gate: CellRead<TRow>
    #report: ReportParseError

    #rules = $state.raw<FormatRule[]>([])
    #compiled = $state.raw<CompiledRules>(NO_COMPILED)

    #highlight = $derived(slotClass('formatHighlight'))

    constructor(grid: GridState<TRow>, options: ConditionalFormattingOptions) {
        this.#grid = grid
        this.#gate = gateReader(grid, 'render')
        this.#report = (id, message, at) => options.onParseError?.(id, message, at)
        this.#apply(normalizeRules(options.rules ?? []))
    }

    #warned = false

    #columns: ReadonlyMap<string, ColumnState<TRow>> = $derived(this.#columnsOf())
    #hasExpression = $derived(this.#rules.some((rule) => rule.kind === 'expression'))
    #stats: RuleStats[] = $derived(this.#compute())

    #columnsOf(): ReadonlyMap<string, ColumnState<TRow>> {
        return columnMap(this.#grid.columns.all)
    }

    #compute(): RuleStats[] {
        if (this.#rules.length === 0) return []
        const rows = dataRowsOf(this.#grid.preWindowNodes, isDataRow)
        return computeStats(this.#rules, rows, this.#columns, this.#gate)
    }

    get skippedRules(): readonly string[] {
        if (this.#grid.rowModel !== 'server') return []
        return this.#rules
            .filter((rule) => rule.kind !== 'expression')
            .map((rule) => rule.id ?? rule.kind)
    }

    #skips(rule: FormatRule): boolean {
        if (this.#grid.rowModel !== 'server' || rule.kind === 'expression') return false
        if (!this.#warned) {
            this.#warned = true
            // eslint-disable-next-line no-console
            console.warn(SERVER_SKIP)
        }
        return true
    }

    #apply(rules: FormatRule[]): void {
        this.#rules = rules
        this.#compiled = compileRules(rules, this.#report)
    }

    errorOf = (id: string): RuleParseError | null => this.#compiled.get(id)?.error ?? null

    get rules(): readonly FormatRule[] {
        return this.#rules
    }

    setRules = (rules: readonly FormatRule[]): void => {
        this.#apply(normalizeRules(rules))
    }

    addRule = (rule: FormatRule): void => {
        this.#apply(normalizeRules([...this.#rules, rule]))
    }

    removeRule = (id: string): void => {
        this.#apply(this.#rules.filter((rule, index) => ruleId(rule, index) !== id))
    }

    clearRules = (): void => {
        this.#apply([])
    }

    #readerFor = (node: RowNode<TRow>) => (columnId: string) => {
        const column = this.#columns.get(columnId)
        return column ? this.#gate(node, column.def) : undefined
    }

    #contextFor(node: RowNode<TRow>, column: ColumnState<TRow>): PaintContext {
        return {
            value: this.#gate(node, column.def),
            rowId: node.id,
            read: this.#hasExpression ? this.#readerFor(node) : NO_READ,
            node: null,
            highlight: this.#highlight
        }
    }

    #nodeFor(rule: FormatRule, index: number): PaintContext['node'] {
        return this.#compiled.get(ruleId(rule, index))?.node ?? null
    }

    decoration = (node: RowNode<TRow>, column: ColumnState<TRow>): CellDecoration | undefined => {
        const rules = this.#rules
        if (rules.length === 0 || isLoadingRow(node.row)) return undefined

        const stats = this.#stats
        let context: PaintContext | undefined
        let paint: Paint | undefined

        for (const [index, rule] of rules.entries()) {
            if (!appliesTo(rule, column.id) || this.#skips(rule)) continue
            context ??= this.#contextFor(node, column)
            context.node = this.#nodeFor(rule, index)

            const next = paintOf(rule, stats[index] ?? null, context)
            if (next) paint = mergePaint(paint, next)
        }

        return isPainted(paint) ? paint : undefined
    }

    serialize = (): FormatRule[] | undefined =>
        this.#rules.length === 0 ? undefined : copyRules(this.#rules)

    hydrate = (slice: unknown): void => {
        const next = sanitizeRules(slice)
        if (next) this.#apply(next)
    }
}

export function conditionalFormatting<TRow>(
    options: ConditionalFormattingOptions = {}
): GridFeature<TRow> {
    return {
        id: CONDITIONAL_FORMATTING,
        createState: (grid) => new ConditionalFormatting(grid, options),
        createApi: (grid) => {
            const state = getConditionalFormatting(grid)!
            return {
                setFormatRules: state.setRules,
                addFormatRule: state.addRule,
                removeFormatRule: state.removeRule,
                clearFormatRules: state.clearRules,
                getFormatRules: () => copyRules(state.rules)
            }
        },
        cellDecoration: ({ grid, node, column }) =>
            getConditionalFormatting(grid)?.decoration(node, column),
        serialize: (grid) => getConditionalFormatting(grid)?.serialize(),
        hydrate: (slice, grid) => getConditionalFormatting(grid)?.hydrate(slice)
    }
}

export function getConditionalFormatting<TRow>(
    grid: GridState<TRow>
): ConditionalFormatting<TRow> | undefined {
    return grid.feature<ConditionalFormatting<TRow>>(CONDITIONAL_FORMATTING)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        setFormatRules?: (rules: readonly FormatRule[]) => void
        addFormatRule?: (rule: FormatRule) => void
        removeFormatRule?: (id: string) => void
        clearFormatRules?: () => void
        getFormatRules?: () => FormatRule[]
    }
}
