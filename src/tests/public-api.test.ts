import { describe, expect, it } from 'vitest'
import * as api from '$lib/index.js'

/**
 * The runtime surface, spelled out. Types are not in it - they cost nothing and
 * break nobody at runtime - so this list is what an app can actually call.
 *
 * A symbol earns a place by being something an app does with the grid. If a
 * change adds a name here, the question to answer is what documented task
 * needs it; if it removes one, that is a breaking change and a major version.
 */
const PUBLIC_API = [
    // Components
    'DataGrid',
    'Grid',
    // Grid instance
    'createDataGrid',
    'getCellValue',
    'SELECTION_COLUMN_ID',
    'SNAPSHOT_VERSION',
    // Configuration and icons
    'defineDataGridConfig',
    'resetDataGridConfig',
    'registerDataGridIcons',
    'datagridIcons',
    'defaultLabels',
    'mergeLabels',
    // Writing a feature
    'PIPELINE_ORDER',
    // Feature modules
    'columnOps',
    'editing',
    'filtering',
    'pagination',
    'rowPinning',
    'rowReorder',
    'selection',
    'sorting',
    'virtualization',
    // Feature state accessors
    'getColumnOps',
    'getEditing',
    'getFiltering',
    'getPagination',
    'getRowPinning',
    'getRowReorder',
    'getSelection',
    'getSorting',
    'getVirtualization',
    // Server row model requests
    'toFilterRequest',
    'toSortRequest',
    // Export and clipboard
    'pickColumns',
    'rowsToMatrix',
    'toCsv',
    'toTsv',
    'withHeaderRow',

    // The panels reach an app through `Grid.*`, with the rest of the parts.
    // Columns worked out from the data
    'autoColumns',
    // Rows a feature synthesized are not rows a pass over the data counts
    'isDataRow',
    'isLoadingRow',
    'isDetailNode',
    // A shared link that will not fit
    'ShareTooLongError',
    // The sixteen modules
    'advancedFilter',
    'commandPalette',
    'conditionalFormatting',
    'dataImport',
    'findReplace',
    'formula',
    'grouping',
    'masterDetail',
    'policy',
    'rangeSelection',
    'savedViews',
    'serverRowModel',
    'showValuesAs',
    'tree',
    'workerDataSource',
    // Their state accessors
    'getAdvancedFilter',
    'getCommandPalette',
    'getConditionalFormatting',
    'getDataImport',
    'getFindReplace',
    'getFormula',
    'getGrouping',
    'getMasterDetail',
    'getPolicy',
    'getRangeSelection',
    'getSavedViews',
    'getServerRowModel',
    'getShowValuesAs',
    'getTree',
    // Aggregation, formulas and saved-view storage an app reaches for directly
    'aggregate',
    'totalsKindOf',
    'FormulaError',
    'isFormulaError',
    'FUNCTION_NAMES',
    'localStorageViews'
].sort()

describe('public API', () => {
    it('exports exactly what it means to export', () => {
        // The namespace object holds the live bindings, so its keys are the
        // exports themselves rather than a list somebody kept up to date.
        expect(Object.keys(api).sort()).toEqual(PUBLIC_API)
    })

    it('exports no symbol that is only wiring', () => {
        // Each of these was reachable once and nothing outside the library ever
        // reached for it: internal defaults, context plumbing, the variants
        // factory that would have made every class name an API.
        for (const name of [
            'formatCurrency',
            'formatDate',
            'formatNumber',
            'formatPercent',
            'isBlank',
            'toDate',
            'toNumber',
            'formatCellText',
            'datagridVariants',
            'getGridContext',
            'setGridContext',
            'GridCellValue',
            'DEFAULT_EMPTY_TEXT',
            'DEFAULT_CSV_DELIMITER',
            'HEADER_ROW',
            'ROW_HANDLE_COLUMN_ID',
            'isSyntheticColumn',
            'dataColumns',
            'downloadCsv',
            'neutralizeFormula',
            'documentLocale',
            'resolveLocale',
            'defaultAnnouncerStrings',
            'filterConditions',
            'isFilterGroup',
            'normalizeFilterEntry',
            'DATE_OPS',
            'NUMBER_OPS',
            'TEXT_OPS'
        ]) {
            expect(api).not.toHaveProperty(name)
        }
    })
})
