import type {
    DataGridLabels,
    DataGridLabelsInput,
    DateFilterOp,
    NumberFilterOp,
    TextFilterOp
} from '../types/index.js'

/** Order, kept apart from wording so a translation cannot reshuffle it. */
export const TEXT_OPS: TextFilterOp[] = [
    'contains',
    'notContains',
    'equals',
    'notEqual',
    'startsWith',
    'endsWith',
    'blank',
    'notBlank'
]
export const NUMBER_OPS: NumberFilterOp[] = [
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'blank',
    'notBlank'
]
export const DATE_OPS: DateFilterOp[] = [
    'equals',
    'before',
    'after',
    'between',
    'blank',
    'notBlank'
]

export const defaultLabels: DataGridLabels = {
    search: 'Search...',
    activeFilters: 'Active filters',
    removeFilter: (column) => `Remove filter ${column}`,
    clearAllFilters: 'Clear all',
    chooseColumns: 'Choose columns',
    rowDensity: 'Row density',
    densityCompact: 'Compact density',
    densityStandard: 'Standard density',
    densityComfortable: 'Comfortable density',

    columnMenu: (column) => `${column} column menu`,
    resizeColumn: (column) => `Resize ${column} column`,
    resizeGroup: (group) => `Resize ${group} group`,
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    clearSort: 'Clear sort',
    pinLeft: 'Pin left',
    pinRight: 'Pin right',
    unpin: 'Unpin',
    openFilter: 'Filter…',
    autosize: 'Autosize',
    hideColumn: 'Hide column',
    collapseGroup: (group) => `Collapse ${group}`,
    expandGroup: (group) => `Expand ${group}`,

    filterColumn: (column) => `Filter ${column}`,
    // The first condition keeps the unsuffixed name it has always had, so a
    // second one can appear without renaming the first.
    filterOperator: (ordinal) => (ordinal > 1 ? `Filter operator ${ordinal}` : 'Filter operator'),
    filterValue: (ordinal) => (ordinal > 1 ? `Filter value ${ordinal}` : 'Filter value'),
    filterUpperBound: (ordinal) =>
        ordinal > 1 ? `Filter upper bound ${ordinal}` : 'Filter upper bound',
    valuePlaceholder: 'Value...',
    upperBoundPlaceholder: 'To...',
    searchValues: 'Search values...',
    blankValue: '(blank)',
    combineConditions: 'Combine conditions',
    addCondition: 'Add condition',
    removeCondition: 'Remove condition',
    matchCase: 'Match case',
    apply: 'Apply',
    clear: 'Clear',
    and: 'And',
    or: 'Or',
    yes: 'True',
    no: 'False',
    textOps: {
        contains: 'Contains',
        notContains: 'Does not contain',
        equals: 'Equals',
        notEqual: 'Not equal',
        startsWith: 'Starts with',
        endsWith: 'Ends with',
        blank: 'Is blank',
        notBlank: 'Is not blank'
    },
    numberOps: {
        eq: '=',
        neq: '≠',
        gt: '>',
        gte: '≥',
        lt: '<',
        lte: '≤',
        between: 'Between',
        blank: 'Is blank',
        notBlank: 'Is not blank'
    },
    dateOps: {
        equals: 'Equals',
        before: 'Before',
        after: 'After',
        between: 'Between',
        blank: 'Is blank',
        notBlank: 'Is not blank'
    },

    selectRow: (position) => `Select row ${position}`,
    selectAllRows: 'Select all rows',
    rowActions: 'Row actions',
    dragRow: (position) => `Move row ${position}`,
    expandRow: 'Expand row',
    collapseRow: 'Collapse row',

    rowsPerPage: 'Rows per page',
    pageSizeOption: (size) => `${size} / page`,
    pageRange: (from, to, total) =>
        `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`,
    totalRows: (total) => `${total.toLocaleString()} rows`,
    filteredRows: (filtered, total) =>
        `${filtered.toLocaleString()} of ${total.toLocaleString()} rows`,
    selectedRows: (count) => `${count.toLocaleString()} selected`,
    noData: 'No data',
    retry: 'Retry',

    copy: 'Copy',
    copyWithHeaders: 'Copy with headers',
    exportCsv: 'Export CSV',
    exportAllRows: 'All rows',
    exportLoadedRows: 'Loaded rows',
    exportSelectedRows: 'Selected rows',
    clearSelection: 'Clear selection'
}

/** Overrides over a base language; operator maps merge one entry at a time. */
export function mergeLabels(
    overrides: DataGridLabelsInput | undefined,
    base: DataGridLabels = defaultLabels
): DataGridLabels {
    if (!overrides) return base
    return {
        ...base,
        ...overrides,
        textOps: { ...base.textOps, ...overrides.textOps },
        numberOps: { ...base.numberOps, ...overrides.numberOps },
        dateOps: { ...base.dateOps, ...overrides.dateOps }
    }
}
