import { Announcer, defaultAnnouncerStrings } from '../interaction/announcer.svelte.js'
import { defaultLabels, mergeLabels } from '../interaction/labels.js'
import { resolveLocale } from '../interaction/locale.js'
import { ColumnModel } from '../columns/column-model.svelte.js'
import { groupIdsOf } from '../columns/header-groups.js'
import { EventBus } from './events.js'
import { ExpansionModel } from '../interaction/expansion.svelte.js'
import { FocusModel } from '../interaction/focus-model.svelte.js'
import { composePipeline, PIPELINE_ORDER, type Pipeline } from './pipeline.svelte.js'
import { buildRowNodes, nodesById } from './row-node.js'
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
    /** Cast because the kernel's own members are filled in the constructor,
     * after the features have had their turn. */
    readonly api: GridApi = {} as GridApi
    readonly getRowId: (row: TRow) => string
    readonly rowClass?: (node: RowNode<TRow>) => ClassNameValue
    /** Undefined until the presentation layer fills it from the theme config. */
    readonly configuredDensity: Density | undefined
    readonly rowModel: RowModel
    readonly focus: FocusModel<TRow>
    readonly announcer: Announcer<TRow>

    /**
     * BCP-47 tag in force; undefined follows the page. Assign to switch
     * language in place, keeping the sort, filter and selection.
     */
    locale = $state<string | undefined>(undefined)

    // Set in the constructor, before anything below is ever read.
    #locales: DataGridLocalePack[] = []
    #labelOverrides: DataGridLabelsInput | undefined = undefined
    #announcerOverrides: Partial<DataGridAnnouncerStrings> | undefined = undefined

    /** The pack answering for `locale`, or none when English will do. */
    #pack = $derived(resolveLocale(this.#locales, this.locale))

    /**
     * Every string the grid's own UI renders: English, with the chosen pack
     * over it, with this app's own overrides over that. Layered rather than
     * swapped, so a string the pack does not carry is the English one rather
     * than nothing at all.
     */
    labels: DataGridLabels = $derived(
        mergeLabels(this.#labelOverrides, mergeLabels(this.#pack?.labels, defaultLabels))
    )

    /** Every string it announces, layered the same way. */
    announcerStrings: DataGridAnnouncerStrings = $derived({
        ...defaultAnnouncerStrings,
        ...this.#pack?.announcer,
        ...this.#announcerOverrides
    })
    readonly expansion: ExpansionModel

    /**
     * The features gating cell values. Empty is the case that costs nothing:
     * every read below checks the length and then behaves as it always did.
     *
     * Nothing here is cached. A gate reads whatever it likes — the role the
     * app is showing the grid as, a rule the user just changed — and asking it
     * again is how the answer stays current. There is no invalidation call for
     * a feature to forget, and forgetting one would mean showing what it was
     * asked to hide. The callers that read a whole column at a time ask once
     * and loop, which is where the calls would otherwise multiply.
     */
    #valueGates: readonly GridFeature<TRow>[] = []

    #baseNodes = $derived.by(() => buildRowNodes(this.data, this.getRowId))
    #baseById = $derived.by(() => nodesById(this.#baseNodes))
    #pipeline: Pipeline<TRow>

    /** Kept apart so the constructor stays one thing: wiring the pipeline. */
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
        // Assigned last so a feature cannot shadow the kernel's own API.
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

    get sourceNodes(): RowNode<TRow>[] {
        return this.#pipeline.before(PIPELINE_ORDER.filter)()
    }

    get totalRows(): number {
        return this.preWindowNodes.length
    }

    feature<TState>(id: string): TState | undefined {
        return this.state[id] as TState | undefined
    }

    /** Resolves a row against the unfiltered source: a filtered-out row is
     * still one an edit may address. */
    nodeById(id: string): RowNode<TRow> | undefined {
        return this.#baseById.get(id)
    }

    /** A JSON-serializable snapshot of everything the user can rearrange. */
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

    /** Restores a snapshot produced by `getState`. */
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

    /**
     * The reader standing in front of one column for one purpose, or
     * undefined when nothing stands there.
     *
     * Hoist it out of a loop over rows. It is fixed for the column, which is
     * why the passes that read a whole column at a time — export, the quick
     * filter's text, the set filter's value list — ask once and then loop.
     */
    readerFor(
        columnId: string,
        purpose: CellValuePurpose = 'render'
    ): CellValueReader<TRow> | undefined {
        if (this.#valueGates.length === 0) return undefined
        const column = this.columns.get(columnId)
        return column ? this.#readerFor(column, purpose) : undefined
    }

    /** The same, for a caller already holding the column. */
    #readerFor(
        column: ColumnState<TRow>,
        purpose: CellValuePurpose
    ): CellValueReader<TRow> | undefined {
        if (this.#valueGates.length === 0) return undefined
        return composeReaders(this.#valueGates, { grid: this, column, purpose })
    }

    /**
     * One cell, as the given purpose is allowed to see it. The default is what
     * the cell draws, which is what every renderer, tooltip and `cell` snippet
     * asks for.
     */
    getValue(
        node: RowNode<TRow>,
        column: ColumnState<TRow>,
        purpose: CellValuePurpose = 'render'
    ): unknown {
        return readCell(node, column.def, this.#readerFor(column, purpose))
    }
}

export function createDataGrid<TRow>(options: DataGridOptions<TRow>): GridState<TRow> {
    return new GridState(options)
}
