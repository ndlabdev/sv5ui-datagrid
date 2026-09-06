import { GridBody, GridFilterRow, GridHeader, GridRoot, GridViewport } from './grid/index.js'
import { GridContextMenu } from './menus/index.js'
import {
    GridColumnChooser,
    GridDensityToggle,
    GridExportMenu,
    GridFilterChips,
    GridPagination,
    GridQuickFilter,
    GridStatusBar,
    GridToolbar,
    RangeStatusBar
} from './chrome/index.js'
import {
    CommandPalette,
    ConditionalFormattingPanel,
    FilterBuilder,
    FindReplace,
    GroupPanel,
    ImportWizard,
    SavedViews,
    ToolPanel
} from './panels/index.js'

/**
 * The compound API: one namespace holding the parts an app assembles when
 * `DataGrid` renders more, or less, than it wants.
 *
 * The panels are here for the same reason the toolbar's controls are: they are
 * parts, and offering nine of them as loose names beside `DataGrid` would say
 * they are something else. `FormatPanel` is the one short name, because
 * `Grid.ConditionalFormattingPanel` reads as a sentence rather than a part.
 *
 * It lives beside the barrel rather than in it because it is a composition of
 * three folders — structure, chrome and menus — and the barrel's job is to
 * aggregate, not to build. The short keys are the API; the file names they
 * come from are not.
 */
export interface GridParts {
    Root: typeof GridRoot
    Viewport: typeof GridViewport
    Header: typeof GridHeader
    FilterRow: typeof GridFilterRow
    Body: typeof GridBody
    Pagination: typeof GridPagination
    Toolbar: typeof GridToolbar
    QuickFilter: typeof GridQuickFilter
    DensityToggle: typeof GridDensityToggle
    ColumnChooser: typeof GridColumnChooser
    ExportMenu: typeof GridExportMenu
    ContextMenu: typeof GridContextMenu
    FilterChips: typeof GridFilterChips
    StatusBar: typeof GridStatusBar

    /** The panels, on the same namespace for the same reason. */
    GroupPanel: typeof GroupPanel
    FilterBuilder: typeof FilterBuilder
    FindReplace: typeof FindReplace
    SavedViews: typeof SavedViews
    ImportWizard: typeof ImportWizard
    CommandPalette: typeof CommandPalette
    FormatPanel: typeof ConditionalFormattingPanel
    ToolPanel: typeof ToolPanel
    RangeStatusBar: typeof RangeStatusBar
}

export const Grid: GridParts = {
    Root: GridRoot,
    Viewport: GridViewport,
    Header: GridHeader,
    FilterRow: GridFilterRow,
    Body: GridBody,
    Pagination: GridPagination,
    Toolbar: GridToolbar,
    QuickFilter: GridQuickFilter,
    DensityToggle: GridDensityToggle,
    ColumnChooser: GridColumnChooser,
    ExportMenu: GridExportMenu,
    ContextMenu: GridContextMenu,
    FilterChips: GridFilterChips,
    StatusBar: GridStatusBar,

    GroupPanel,
    FilterBuilder,
    FindReplace,
    SavedViews,
    ImportWizard,
    CommandPalette,
    FormatPanel: ConditionalFormattingPanel,
    ToolPanel,
    RangeStatusBar
}
