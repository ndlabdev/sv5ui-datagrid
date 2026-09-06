/**
 * What the rest of the library reaches into the writer for.
 *
 * An application does not come through here: the workbook writer has an entry
 * of its own at `@sv5ui/datagrid/xlsx`, and `src/lib/xlsx.ts` names the whole
 * public surface from the files directly. Listing all of it again here would
 * be a second copy of that decision, kept in step by nobody.
 *
 * `buildGridXlsxAsync`, `workbookEntries` and `XlsxStyle` are here for the
 * budget tests, which weigh the writer without going through the entry.
 */

export { buildGridXlsx, buildGridXlsxAsync } from './export.js'
export { BUILT_IN_STYLES, StyleTable } from './styles.js'
export type { XlsxStyle } from './styles.types.js'
export { createWorkbook, workbookEntries } from './workbook.js'
export { createZip, deflateEntries, zipEntry } from './zip.js'
