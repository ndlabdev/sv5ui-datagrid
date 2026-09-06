/**
 * What a rule paints when it matches: a class, inline declarations, or both.
 *
 * The style record is keyed by CSS property and goes onto the cell through
 * `CellDecoration.style`, which the grid's own layout outranks:
 * a rule can colour a cell but cannot move it out of its column.
 */
export interface FormatPaint {
    /**
     * Classes merged onto the cell. Any class the app's Tailwind build knows
     * about, applied as written - including from a hydrated share link, which
     * is the one path where the rule was not authored by the app.
     */
    class?: string

    /**
     * Declarations written onto the cell, keyed by CSS property. A value is
     * cut at the first `;`, so one entry stays one declaration.
     */
    style?: Record<string, string>
}

/** Fields every rule carries. */
export interface FormatRuleBase {
    /**
     * Stable id, so a rule can be removed or replaced by name. Generated from
     * the rule's position when omitted, which is enough for a static list and
     * not enough for one the user edits.
     */
    id?: string
}

/**
 * A continuous colour ramp across the column's range: the lowest value gets
 * `from`, the highest `to`, everything between a mix of the two.
 *
 * Mixing happens in CSS (`color-mix`), not in JavaScript, so a theme token
 * (`var(--color-primary)`) works as a stop and follows the theme when it
 * changes - which a hex value interpolated at build time cannot.
 */
export interface ColorScaleRule extends FormatRuleBase {
    kind: 'colorScale'

    /** Column the ramp reads and paints. */
    column: string

    /**
     * Colour at the low end. Any CSS colour, including a theme token.
     *
     * @default 'transparent'
     */
    from?: string

    /**
     * Colour at the high end.
     *
     * @default 'var(--color-primary)'
     */
    to?: string

    /** Optional middle stop, making the ramp three-colour rather than two. */
    via?: string

    /**
     * Value that counts as the low end. Defaults to the smallest value in the
     * column after filtering, so the ramp always spans what the grid shows.
     */
    min?: number

    /** Value that counts as the high end. Defaults to the largest. */
    max?: number
}

/**
 * A bar drawn behind the value, its width proportional to the value's place
 * in the column's range. Drawn as a background gradient, so it costs no
 * element and never intercepts a click.
 */
export interface DataBarRule extends FormatRuleBase {
    kind: 'dataBar'

    /** Column the bar reads and paints. */
    column: string

    /**
     * Bar colour. Any CSS colour, including a theme token.
     *
     * @default 'color-mix(in oklab, var(--color-primary) 35%, transparent)'
     */
    color?: string

    /** Colour for negative values, when they should read differently. */
    negativeColor?: string

    /**
     * Value at which the bar is empty. Defaults to the smallest value in the
     * column, or to zero when every value is positive - a bar measured from
     * the smallest value would otherwise show the smallest row as empty.
     */
    min?: number

    /** Value at which the bar is full. Defaults to the largest. */
    max?: number
}

/**
 * Paints the cells of rows where an expression is true.
 *
 * The condition is written as **text** in the same language as a formula
 * column (`status = "overdue" AND total > 1000`), evaluated by the same
 * hand-written parser - never `eval`. Text rather than a callback because a
 * string round-trips: a rule travels into saved views, share links and
 * `getState`/`setState`, which a function cannot.
 */
export interface ExpressionRule extends FormatRuleBase, FormatPaint {
    kind: 'expression'

    /**
     * Column to paint. Omit to paint the whole row - the expression is
     * evaluated once per row either way.
     */
    column?: string

    /** The condition, as text. A row is painted when it evaluates truthy. */
    when: string
}

/**
 * Paints values that appear more than once in the column - the fastest way to
 * see a duplicated email or SKU without writing a query.
 */
export interface DuplicatesRule extends FormatRuleBase, FormatPaint {
    kind: 'duplicates'

    /** Column whose values are counted. */
    column: string

    /**
     * Paints the values that appear exactly once instead of the repeated ones.
     *
     * @default false
     */
    unique?: boolean
}

/**
 * Paints the highest (or lowest) values in the column, by rank rather than by
 * threshold - the rule survives the numbers changing.
 */
export interface TopNRule extends FormatRuleBase, FormatPaint {
    kind: 'topN'

    /** Column whose values are ranked. */
    column: string

    /**
     * How many rows to paint. Ties are painted too, so a column with five
     * rows sharing the tenth-largest value paints more than `n` cells.
     *
     * @default 10
     */
    n?: number

    /**
     * Ranks from the bottom instead of the top.
     *
     * @default false
     */
    bottom?: boolean
}

/** Any rule the feature understands. */
export type FormatRule = ColorScaleRule | DataBarRule | ExpressionRule | DuplicatesRule | TopNRule

export interface ConditionalFormattingOptions {
    /**
     * Rules in paint order: a later rule wins a property an earlier one also
     * set, the way `CellDecoration.style` merges. At most 64 are kept - a
     * hydrated share link is untrusted input, and the hook runs per rendered
     * cell.
     */
    rules?: FormatRule[]

    /**
     * Called when a rule's expression fails to parse - on the initial options
     * and on every later edit. Reported rather than thrown, so one bad rule
     * cannot take a grid down; the rule simply paints nothing.
     */
    onParseError?: (ruleId: string, message: string, at: number) => void
}
