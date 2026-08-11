import { describe, expect, it } from 'vitest'
import * as api from '$lib/index.js'

/**
 * The runtime surface, spelled out. Types are not in it — they cost nothing and
 * break nobody at runtime — so this list is what an app can actually call.
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
    'withHeaderRow'
].sort()

describe('public API', () => {
    it('exports exactly what it means to export', () => {
        const actual = Object.keys(api)
            .filter((key) => api[key as keyof typeof api] !== undefined)
            .sort()
        expect(actual).toEqual(PUBLIC_API)
    })

    it('exports no symbol that is only wiring', () => {
        // Each of these was reachable once and nothing outside the library ever
        // reached for it: internal defaults, context plumbing, the variants
        // factory that would have made every class name an API.
        for (const name of [
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
            'formatCurrency',
            'formatDate',
            'formatNumber',
            'formatPercent',
            'toDate',
            'toNumber',
            'isBlank',
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
