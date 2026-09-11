import { Announcer, defaultAnnouncerStrings } from '../interaction/announcer.svelte.js'
import { defaultLabels, mergeLabels } from '../interaction/labels.js'
import { resolveLocale } from '../interaction/locale.js'
import { ColumnModel } from '../columns/column-model.svelte.js'
import { groupIdsOf } from '../columns/header-groups.js'
import { EventBus } from './events.js'
import { ExpansionModel } from '../interaction/expansion.svelte.js'
import { FocusModel } from '../interaction/focus-model.svelte.js'
import { composePipeline, PIPELINE_ORDER, type Pipeline } from './pipeline.svelte.js'
import { buildRowNodes, isDataRow, nodesById } from './row-node.js'
import { buildColumnSnapshot, isDensity, resolveColumnSnapshot } from './snapshot.js'
import type { ClassNameValue } from 'tailwind-merge'
import { composeReaders, readCell } from './value-gate.js'
import {
    SNAPSHOT_VERSION,
    type CellValuePurpose,
    type CellValueReader,
    type ColumnState,
    type DataGridAnnouncerStrings,
    type DataGridLabels,
    type DataGridLabelsInput,
    type DataGridLocalePack,
    type DataGridOptions,
    type Density,
    type GridApi,
    type GridEventMap,
    type GridFeature,
    type GridSnapshot,
    type RowModel,
    type RowNode
} from '../types/index.js'

export class GridState<TRow> {
    data = $state.raw<TRow[]>([])
    density = $state<Density>('standard')

    readonly columns: ColumnModel<TRow>
    readonly events = new EventBus<GridEventMap>()
    readonly features: readonly GridFeature<TRow>[]
    readonly state: Record<string, unknown> = {}
    readonly api: GridApi = {} as GridApi
    readonly getRowId: (row: TRow) => string
    readonly rowClass?: (node: RowNode<TRow>) => ClassNameValue
    readonly configuredDensity: Density | undefined
    readonly rowModel: RowModel
    readonly focus: FocusModel<TRow>
    readonly announcer: Announcer<TRow>

    locale = $state<string | undefined>(undefined)

    #locales: DataGridLocalePack[] = []
    #labelOverrides: DataGridLabelsInput | undefined = undefined
    #announcerOverrides: Partial<DataGridAnnouncerStrings> | undefined = undefined

    #pack = $derived(resolveLocale(this.#locales, this.locale))

    labels: DataGridLabels = $derived(
        mergeLabels(this.#labelOverrides, mergeLabels(this.#pack?.labels, defaultLabels))
    )

    announcerStrings: DataGridAnnouncerStrings = $derived({
        ...defaultAnnouncerStrings,
        ...this.#pack?.announcer,
        ...this.#announcerOverrides
    })
    readonly expansion: ExpansionModel

    #valueGates: readonly GridFeature<TRow>[] = []

    #baseNodes = $derived.by(() => buildRowNodes(this.data, this.getRowId))
    #baseById = $derived.by(() => nodesById(this.#baseNodes))
    #pipeline: Pipeline<TRow>

    #applyLocale(options: DataGridOptions<TRow>): void {
        this.#locales = options.locales ?? []
        this.#labelOverrides = options.labels
        this.#announcerOverrides = options.announcer
        this.locale = options.locale
    }

    constructor(options: DataGridOptions<TRow>) {
        this.data = options.data ?? []
        this.getRowId = options.getRowId
        this.rowClass = options.rowClass
        this.configuredDensity = options.density
        this.rowModel = options.rowModel ?? 'client'
        this.columns = new ColumnModel(options.columns)
        this.expansion = new ExpansionModel(this.events)
        this.features = [...(options.features ?? [])]
        this.#valueGates = this.features.filter((feature) => feature.cellValue !== undefined)
        this.density = options.density ?? 'standard'
        this.#applyLocale(options)

        for (const feature of this.features) {
            if (feature.createState) this.state[feature.id] = feature.createState(this)
        }
        for (const feature of this.features) {
            if (feature.createApi) Object.assign(this.api, feature.createApi(this))
        }
        Object.assign(this.api, {
            getState: () => this.getState(),
            setState: (snapshot: GridSnapshot) => this.setState(snapshot)
        })

        this.focus = new FocusModel(
            this,
            this.features.flatMap((feature) => feature.keybindings ?? [])
        )
        this.announcer = new Announcer(this, () => this.announcerStrings)

        const stages = this.features.flatMap((feature) => feature.pipelineStage ?? [])
        if (stages.filter((stage) => stage.order === PIPELINE_ORDER.window).length > 1) {
            throw new Error(
                'Only one window-order feature may be registered - use pagination() or virtualization(), not both'
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

    get sourceNodes(): RowNode<TRow>[] {
        return this.#pipeline.before(PIPELINE_ORDER.filter)()
    }

    get filteredNodes(): RowNode<TRow>[] {
        return this.#pipeline.before(PIPELINE_ORDER.group)()
    }

    get totalRows(): number {
        return this.preWindowNodes.length
    }

    get filteredRowCount(): number {
        for (const feature of this.features) {
            const answered = feature.rowCount?.(this)
            if (answered !== undefined) return answered
        }
        return this.filteredNodes.reduce((count, node) => (isDataRow(node) ? count + 1 : count), 0)
    }

    feature<TState>(id: string): TState | undefined {
        return this.state[id] as TState | undefined
    }

    nodeById(id: string): RowNode<TRow> | undefined {
        return this.#baseById.get(id)
    }

    getState(): GridSnapshot {
        const snapshot: GridSnapshot = { version: SNAPSHOT_VERSION }

        const columns = buildColumnSnapshot(this.columns)
        if (columns) snapshot.columns = columns
        if (this.density !== 'standard') snapshot.density = this.density

        const features: Record<string, unknown> = {}
        for (const feature of this.features) {
            const slice = feature.serialize?.(this)
            if (slice !== undefined) features[feature.id] = slice
        }
        if (Object.keys(features).length > 0) snapshot.features = features

        return snapshot
    }

    setState(snapshot: GridSnapshot): void {
        const columns = resolveColumnSnapshot(
            snapshot.columns,
            this.columns.leafDefs.map((def) => def.id),
            groupIdsOf(this.columns.defs)
        )
        this.columns.orderIds = columns.orderIds
        this.columns.widthOverrides = columns.widthOverrides
        this.columns.hiddenOverrides = columns.hiddenOverrides
        this.columns.pinnedOverrides = columns.pinnedOverrides
        this.columns.collapsedGroups = columns.collapsedGroups

        if (isDensity(snapshot.density)) this.density = snapshot.density

        for (const feature of this.features) {
            const slice = snapshot.features?.[feature.id]
            if (slice !== undefined) feature.hydrate?.(slice, this)
        }
    }

    readerFor(
        columnId: string,
        purpose: CellValuePurpose = 'render'
    ): CellValueReader<TRow> | undefined {
        if (this.#valueGates.length === 0) return undefined
        const column = this.columns.get(columnId)
        return column ? this.#readerFor(column, purpose) : undefined
    }

    #readerFor(
        column: ColumnState<TRow>,
        purpose: CellValuePurpose
    ): CellValueReader<TRow> | undefined {
        if (this.#valueGates.length === 0) return undefined
        return composeReaders(this.#valueGates, { grid: this, column, purpose })
    }

    status = $state.raw<GridStatus | undefined>(undefined)

    ui = $state.raw<Record<string, unknown> | undefined>(undefined)

    getValue(
        node: RowNode<TRow>,
        column: ColumnState<TRow>,
        purpose: CellValuePurpose = 'render'
    ): unknown {
        return readCell(node, column.def, this.#readerFor(column, purpose))
    }
}

/** What the body draws when a feature is fetching the rows rather than holding them. */
export interface GridStatus {
    loading?: boolean
    error?: unknown
    onRetry?: () => void
}

export function createDataGrid<TRow>(options: DataGridOptions<TRow>): GridState<TRow> {
    return new GridState(options)
}
