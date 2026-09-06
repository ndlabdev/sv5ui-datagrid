/**
 * The workbook writer, on an entry of its own.
 *
 * It is a library rather than a feature: no grid is involved in
 * `createWorkbook`, and an app that only wants to write a spreadsheet should
 * not have to reach through a data grid to find one. Splitting the entry is
 * also what keeps it out of the main bundle for everybody who does not.
 */

export {
    buildGridXlsx,
    buildGridXlsxAsync,
    downloadGridXlsx,
    type ExportXlsxOptions
} from './features/xlsx/export.js'

export {
    createWorkbook,
    createWorkbookAsync,
    XLSX_MIME,
    type WorkbookOptions,
    type WorkbookSheet
} from './features/xlsx/workbook.js'

export {
    cellRef,
    columnLetter,
    DEFAULT_STYLE,
    toSerialDate,
    type CellValue,
    type SheetColumn,
    type SheetOptions,
    type StyleId,
    type XlsxFormula
} from './features/xlsx/sheet.js'

export { BUILT_IN_STYLES, StyleTable } from './features/xlsx/styles.js'

export type {
    XlsxAlignment,
    XlsxBorder,
    XlsxBorderSide,
    XlsxColor,
    XlsxFont,
    XlsxStyle
} from './features/xlsx/styles.types.js'

export {
    DEFAULT_FORMAT_COLORS,
    type XlsxCfRule,
    type XlsxFormatColors
} from './features/xlsx/conditional-format.js'
