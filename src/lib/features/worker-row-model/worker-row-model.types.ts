import { type ColumnDef } from '../../core/types/index.js'

/**
 * How a `workerDataSource` reads the rows it was handed.
 *
 * Every option here has to survive `postMessage`, which is the whole
 * constraint the feature lives under: a function cannot cross to a worker, so
 * a column carrying one is rejected when the store is built rather than
 * answered from the raw field behind its back.
 */
export interface WorkerDataSourceOptions<TRow> {
    /**
     * The grid's columns. Their ids name the fields loaded into the worker,
     * and `type: 'date' | 'datetime'` is what makes a column sort as an
     * instant rather than as text, matching how the grid sorts it.
     */
    columns: ColumnDef<TRow>[]

    /**
     * Where blank cells go when a sort has to place them.
     *
     * @default 'first'
     */
    nulls?: 'first' | 'last'

    /**
     * The value to load for a cell, when reading the row cannot produce it.
     *
     * A computed column - a formula column is the case that matters - holds no
     * value on the row: the grid works it out while the pipeline runs, on the
     * client, after the worker has already answered. Filtering or sorting by
     * such a column would otherwise be answered from nothing. Return
     * `undefined` to read the row the ordinary way.
     *
     * @default undefined
     */
    readValue?: (row: TRow, column: ColumnDef<TRow>) => unknown

    /**
     * The text a quick filter should search for a cell, when the value itself
     * is not what the user sees. The grid searches both the value and the text
     * it draws - a currency cell answers to `1234.5` and to `1,234.50` - and a
     * worker has no way to reach the formatter that produced the second, so
     * this is where an app supplies it. Return `undefined` to search the value.
     *
     * @default undefined
     */
    searchText?: (value: unknown, column: ColumnDef<TRow>) => string | undefined

    /**
     * Builds one group row from the keys identifying it and the number of rows
     * beneath it. Required before the grid may group: the worker counts the
     * groups, but only the app knows what one of its own rows looks like, and
     * `getRowMeta` is what turns the result into a group row with a chevron.
     *
     * @default undefined
     */
    groupRow?: (keys: unknown[], count: number) => TRow

    /**
     * Called when the source gives up on its worker and answers on the calling
     * thread instead - the worker threw, or never started. `usingWorker` is a
     * plain getter, so this is what a component needs to know the badge it drew
     * is now wrong.
     *
     * @default undefined
     */
    onFallback?: (reason: string) => void

    /**
     * Run the query on the calling thread instead of in a worker. The answers
     * are identical - it is the same module either way - so this is for
     * measuring what the worker is worth, and for an environment that has no
     * `Worker` at all.
     *
     * @default false
     */
    inline?: boolean
}

/** What a `workerDataSource` adds to the `DataSource` contract it implements. */
export interface WorkerDataSource<TRow> {
    /**
     * Whether the query really is running off the main thread. False when the
     * environment has no `Worker`, when constructing one threw, or when
     * `inline` asked for it - the grid still works, without the frame budget.
     */
    readonly usingWorker: boolean

    /**
     * Replaces the loaded rows and rebuilds the columnar store, in chunks, so
     * no single frame is spent on it. Call it after the app's array changes -
     * an edit committed on the client does not reach the store on its own.
     */
    setRows(rows: TRow[]): void

    /** Terminates the worker. The source answers nothing afterwards. */
    dispose(): void
}
