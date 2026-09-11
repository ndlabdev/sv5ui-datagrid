/** A colour as Excel writes it: `RRGGBB`, or `AARRGGBB` with alpha. */
export type XlsxColor = string

export interface XlsxFont {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    /** Points. @default 11 */
    size?: number
    color?: XlsxColor
    /** @default 'Calibri' */
    name?: string
}

export interface XlsxBorderSide {
    /** @default 'thin' */
    style?: 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double'
    color?: XlsxColor
}

export interface XlsxBorder {
    top?: XlsxBorderSide
    bottom?: XlsxBorderSide
    left?: XlsxBorderSide
    right?: XlsxBorderSide
}

export interface XlsxAlignment {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'middle' | 'bottom'
    /** Wraps long text instead of spilling it into the next cell. */
    wrap?: boolean
    /** Degrees, -90 to 90. */
    rotation?: number
    /** Indent steps from the cell edge. */
    indent?: number
}

/**
 * Everything one cell can look like. Every field is optional and the writer
 * de-duplicates: a hundred thousand cells sharing a look cost one entry in
 * `styles.xml`, because Excel refuses a file whose style table repeats itself
 * past a few thousand entries.
 */
export interface XlsxStyle {
    font?: XlsxFont
    /** Solid background fill. */
    fill?: XlsxColor
    border?: XlsxBorder
    alignment?: XlsxAlignment
    /**
     * An Excel number format code - `#,##0.00`, `0.0%`, `yyyy-mm-dd`,
     * `[$$-409]#,##0.00`. Overrides whatever the column's `type` would pick.
     */
    numberFormat?: string
}
