export type EditMode = 'cell' | 'row'

export interface EditingOptions {
    /**
     * `'cell'` edits one cell at a time; `'row'` puts every editable
     * cell of a row into edit mode together.
     * @default 'cell'
     */
    mode?: EditMode

    /**
     * Commit the active cell when its editor loses focus.
     * @default true
     */
    commitOnBlur?: boolean
}

export interface EditingCell {
    rowId: string
    columnId: string
}

export type MoveDirection = 'down' | 'right' | 'left'
