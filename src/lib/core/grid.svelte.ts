import { Announcer, defaultLocale } from './announcer.svelte.js'
import { ColumnModel } from './column-model.svelte.js'
import { EventBus } from './events.js'
import { FocusModel } from './focus-model.svelte.js'
import { composePipeline, PIPELINE_ORDER, type Pipeline } from './pipeline.svelte.js'
import { buildRowNodes } from './row-node.js'
import type {
    ColumnState,
    DataGridOptions,
    Density,
    GridEventMap,
    GridFeature,
    RowNode
} from './types.js'
import { getCellValue } from './value.js'

export class GridState<TRow> {
    data = $state.raw<TRow[]>([])
    density = $state<Density>('standard')

    readonly columns: ColumnModel<TRow>
    readonly events = new EventBus<GridEventMap>()
    readonly features: readonly GridFeature<TRow>[]
    readonly state: Record<string, unknown> = {}
    readonly api: Record<string, unknown> = {}
    readonly getRowId: (row: TRow) => string
    readonly focus: FocusModel<TRow>
    readonly announcer: Announcer<TRow>

    #baseNodes = $derived.by(() => buildRowNodes(this.data, this.getRowId))
    #pipeline: Pipeline<TRow>

    constructor(options: DataGridOptions<TRow>) {
        this.data = options.data ?? []
        this.getRowId = options.getRowId
        this.columns = new ColumnModel(options.columns)
        this.features = [...(options.features ?? [])]
        this.density = options.density ?? 'standard'

        for (const feature of this.features) {
            if (feature.createState) this.state[feature.id] = feature.createState(this)
        }
        for (const feature of this.features) {
            if (feature.createApi) Object.assign(this.api, feature.createApi(this))
        }

        this.focus = new FocusModel(
            this,
            this.features.flatMap((feature) => feature.keybindings ?? [])
        )
        this.announcer = new Announcer(this, { ...defaultLocale, ...options.locale })

        const stages = this.features.flatMap((feature) => feature.pipelineStage ?? [])
        if (stages.filter((stage) => stage.order === PIPELINE_ORDER.window).length > 1) {
            throw new Error(
                'Only one window-order feature may be registered — use pagination() or virtualization(), not both'
            )
        }
        this.#pipeline = composePipeline(() => this.#baseNodes, stages, this)
    }

    get nodes(): RowNode<TRow>[] {
        return this.#pipeline.output()
    }

    get preWindowNodes(): RowNode<TRow>[] {
        return this.#pipeline.before(PIPELINE_ORDER.window)()
    }

    get totalRows(): number {
        return this.preWindowNodes.length
    }

    feature<TState>(id: string): TState | undefined {
        return this.state[id] as TState | undefined
    }

    getValue(node: RowNode<TRow>, column: ColumnState<TRow>): unknown {
        return getCellValue(node.row, column.def)
    }
}

export function createDataGrid<TRow>(options: DataGridOptions<TRow>): GridState<TRow> {
    return new GridState(options)
}
