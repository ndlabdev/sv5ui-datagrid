import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as api from '$lib/index.js'
import * as xlsx from '$lib/xlsx.js'

const PUBLIC_API = [
    'DataGrid',
    'Grid',
    'createDataGrid',
    'getCellValue',
    'SELECTION_COLUMN_ID',
    'SNAPSHOT_VERSION',
    'defineDataGridConfig',
    'resetDataGridConfig',
    'registerDataGridIcons',
    'datagridIcons',
    'defaultLabels',
    'mergeLabels',
    'PIPELINE_ORDER',
    'columnOps',
    'editing',
    'filtering',
    'pagination',
    'rowPinning',
    'rowReorder',
    'selection',
    'sorting',
    'virtualization',
    'getColumnOps',
    'getEditing',
    'getFiltering',
    'getPagination',
    'getRowPinning',
    'getRowReorder',
    'getSelection',
    'getSorting',
    'getVirtualization',
    'toFilterRequest',
    'toSortRequest',
    'pickColumns',
    'rowsToMatrix',
    'toCsv',
    'toTsv',
    'withHeaderRow',

    'autoColumns',
    'isDataRow',
    'isLoadingRow',
    'isDetailNode',
    'ShareTooLongError',
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
    'getAdvancedFilter',
    'getCommandPalette',
    'getConditionalFormatting',
    'getDataImport',
    'getFindReplace',
    'getFormula',
    'getGridContext',
    'getGridElement',
    'getGrouping',
    'getMasterDetail',
    'getPolicy',
    'getRangeSelection',
    'getSavedViews',
    'getServerRowModel',
    'getShowValuesAs',
    'getTree',
    'aggregate',
    'totalsKindOf',
    'FormulaError',
    'isFormulaError',
    'FUNCTION_NAMES',
    'localStorageViews'
].sort()

describe('public API', () => {
    it('exports exactly what it means to export', () => {
        expect(Object.keys(api).sort()).toEqual(PUBLIC_API)
    })

    it('exports no symbol that is only wiring', () => {
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

const XLSX_API = [
    'BUILT_IN_STYLES',
    'CellValue',
    'DEFAULT_FORMAT_COLORS',
    'DEFAULT_STYLE',
    'ExportXlsxOptions',
    'SheetColumn',
    'SheetOptions',
    'StyleId',
    'StyleTable',
    'WorkbookOptions',
    'WorkbookSheet',
    'XLSX_MIME',
    'XlsxAlignment',
    'XlsxBorder',
    'XlsxBorderSide',
    'XlsxCfRule',
    'XlsxColor',
    'XlsxFont',
    'XlsxFormatColors',
    'XlsxFormula',
    'XlsxStyle',
    'buildGridXlsx',
    'buildGridXlsxAsync',
    'cellRef',
    'columnLetter',
    'createWorkbook',
    'createWorkbookAsync',
    'downloadGridXlsx',
    'toSerialDate'
].sort()

function namesIn(source: string): string[] {
    const names: string[] = []
    for (const statement of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
        for (const raw of statement[1]!.split(',')) {
            const name = raw
                .trim()
                .replace(/^type\s+/, '')
                .split(' as ')
                .pop()
                ?.trim()
            if (name) names.push(name)
        }
    }
    return names.sort()
}

describe('the xlsx entry', () => {
    it('offers exactly the names it means to, types included', () => {
        const source = readFileSync(join('src', 'lib', 'xlsx.ts'), 'utf8')
        expect(namesIn(source)).toEqual(XLSX_API)
    })

    it('really resolves each value it names, rather than only declaring it', () => {
        const values = XLSX_API.filter((name) => name in xlsx)
        expect(Object.keys(xlsx).sort()).toEqual(values)
        expect(values.length).toBeGreaterThan(10)
    })
})
