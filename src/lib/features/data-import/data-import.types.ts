import { type ColumnDef } from '../../core/types/index.js'
import type { DecimalMark } from './coerce.js'
import type { DuplicateScope } from './duplicates.js'
import type { ProblemKind } from './stage.js'

/** The formats the wizard offers to read. */
export type ImportFormat = 'csv' | 'tsv' | 'xlsx' | 'clipboard'

/** Which screen the wizard is on. `idle` is "nothing taken yet". */
export type ImportStep = 'idle' | 'mapping' | 'review'

export interface DataImportOptions<TRow> {
    /**
     * Formats offered. A file whose extension is not listed is refused by name
     * rather than guessed at.
     *
     * @default ['csv', 'tsv', 'xlsx', 'clipboard']
     */
    accept?: ImportFormat[]

    /**
     * Called with the rows the user chose to commit. Anything it throws is
     * shown in the wizard rather than swallowed, and the staged rows stay put
     * so nobody loses ten minutes of fixing.
     */
    onCommit: (rows: TRow[]) => void | Promise<void>

    /**
     * Seeds each staged row before the file's values are written over it - an
     * id, a tenant, a default status. The index is the row's position in the
     * file, counting from zero after the header.
     *
     * @default undefined
     */
    newRow?: (index: number) => Partial<TRow>

    /**
     * The message shown on a cell whose text could not be read as the column's
     * type. Return `undefined` to keep the built-in wording.
     *
     * @default undefined
     */
    messageFor?: (kind: ProblemKind, column: ColumnDef<TRow>) => string | undefined

    /**
     * Where the guessed column mapping is remembered, so importing the same
     * report twice is one click the second time. A key of `null` remembers
     * nothing.
     *
     * @default `dg-import:${grid.id}`
     */
    rememberAs?: string | null

    /**
     * Rows read from one file, before it is refused. Guards a paste of a
     * million cells more than it guards a deliberate import.
     *
     * @default 200000
     */
    maxRows?: number

    /**
     * The largest file this will open, in bytes. Checked against `file.size`
     * before a byte is read, which is the cheapest guard there is: a file too
     * big to hold is refused by name instead of being loaded and then regretted.
     *
     * @default 33554432
     */
    maxBytes?: number

    /**
     * Which mark the file's numbers use for the decimal point. Unset guesses,
     * and a guess on `1.250` is genuinely undecidable: it is one and a quarter
     * in one country and twelve hundred and fifty in another. The guess errs
     * towards the smaller reading, because turning money into a thousand times
     * itself is the worse mistake. Say `','` when the files come from a place
     * that writes `1.250,50`.
     *
     * @default undefined
     */
    decimal?: DecimalMark

    /**
     * Sheet to read from an `xlsx` workbook. Unset reads the first.
     *
     * @default undefined
     */
    sheet?: string

    /**
     * Marks a row whose key has been seen already, so importing the same
     * export twice does not double the data. A duplicate is flagged like any
     * other problem: the cell turns red, the review panel counts it, and
     * "add the valid rows" leaves it behind. Nothing is dropped silently.
     *
     * @default undefined
     */
    dedupe?: ImportDedupe
}

/**
 * How an import decides that two rows are the same row. The key is the values
 * of `columns` read together, trimmed and compared without case; a row missing
 * any part of the key has no key and is never called a duplicate.
 */
export interface ImportDedupe {
    /**
     * Grid column ids whose values together identify a row. One id is the
     * common case (`['email']`); several make a composite key.
     */
    columns: string[]

    /**
     * What a key is measured against: rows earlier in the same file, rows the
     * grid already holds, or both.
     *
     * @default 'both'
     */
    against?: DuplicateScope
}

/** One cell the import could not read or could not accept. */
export interface ImportIssue {
    rowIndex: number
    columnId: string
    kind: ProblemKind
    message: string
}
