/**
 * One computed column: the expression, plus what to do when it goes wrong.
 *
 * The column itself is declared the ordinary way in `createDataGrid({ columns })`;
 * this only supplies the value behind it. That split is deliberate - adding a
 * column at runtime is a separate extension point, and a formula
 * column is otherwise an ordinary column in every respect.
 */
export interface FormulaColumn {
    /**
     * The expression, as text. Text rather than a callback because a string
     * round-trips: it serializes into saved views, share links and state
     * persistence, which a function cannot.
     */
    expression: string

    /**
     * What a cell shows when the expression fails for that row.
     *
     * `'code'` writes the error code (`#DIV/0`), the way a spreadsheet does.
     * `'blank'` writes nothing, which reads better in a report but hides the
     * mistake.
     *
     * @default 'code'
     */
    onError?: 'code' | 'blank'
}

export interface FormulaOptions {
    /**
     * Expression per column id. A bare string is shorthand for
     * `{ expression }`.
     *
     * Formula columns may refer to one another; they are evaluated in
     * dependency order. A reference that runs in a circle yields `#CYCLE`
     * rather than hanging.
     */
    columns?: Record<string, string | FormulaColumn>

    /**
     * Called when an expression fails to parse - on the initial options and on
     * every later edit. Parse failures are reported here rather than thrown, so
     * one bad formula cannot take a grid down.
     */
    onParseError?: (columnId: string, message: string, at: number) => void
}
