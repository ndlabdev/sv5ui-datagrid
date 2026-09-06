import { type RowNode } from '../../core/types/index.js'

/**
 * Operators a condition can use. They are Community's own operator names, so
 * a `text` condition here means what a text column filter means there.
 *
 * `blank` / `notBlank` carry no value; `between` carries both `value` and
 * `to`; `in` carries `values`. Everything else carries `value`.
 */
export type AdvancedFilterOp =
    | 'contains'
    | 'notContains'
    | 'equals'
    | 'notEqual'
    | 'startsWith'
    | 'endsWith'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'between'
    | 'before'
    | 'after'
    | 'in'
    | 'blank'
    | 'notBlank'

/** One test against one column. */
export interface FilterCondition {
    kind: 'condition'
    /** Column id, read through the grid's own accessor so a formula column works. */
    columnId: string
    op: AdvancedFilterOp
    /** Left side of `between`, the value for every single-value operator. */
    value?: unknown
    /** Right side of `between`, inclusive. */
    to?: unknown
    /** The list an `in` matches against. */
    values?: unknown[]
    /**
     * Compare text exactly as written.
     * @default false
     */
    caseSensitive?: boolean
}

/** Conditions and nested groups, joined by one operator and optionally negated. */
export interface FilterGroup {
    kind: 'group'
    /** @default 'and' */
    join: 'and' | 'or'
    /**
     * Invert the whole group, which is what makes `NOT (A OR B)` expressible
     * without a separate operator for every condition.
     * @default false
     */
    not?: boolean
    children: FilterNode[]
}

/** A node of the filter tree: a test, or a group of tests. */
export type FilterNode = FilterCondition | FilterGroup

export interface AdvancedFilterOptions<TRow = unknown> {
    /**
     * The tree the grid starts with. An empty group, or no option at all,
     * filters nothing.
     * @default { kind: 'group', join: 'and', children: [] }
     */
    model?: FilterGroup

    /**
     * Called whenever the tree changes, for an app that stores it or sends it
     * to a server. The tree is JSON already; nothing in it is a function.
     */
    onChange?: (model: FilterGroup) => void

    /**
     * Keep a row whatever the tree says. Runs before the tree, so a pinned
     * summary row or a row the app must always show survives a filter.
     */
    alwaysKeep?: (node: RowNode<TRow>) => boolean
}
