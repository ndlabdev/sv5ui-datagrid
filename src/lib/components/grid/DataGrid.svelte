<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { createDataGrid } from '../../core/grid/index.js'
    import { columnOps } from '../../features/column-ops/index.js'
    import { editing } from '../../features/editing/index.js'
    import { filtering } from '../../features/filtering/index.js'
    import { pagination } from '../../features/pagination/index.js'
    import { selection } from '../../features/selection/index.js'
    import { sorting } from '../../features/sorting/index.js'
    import { getVirtualization, virtualization } from '../../features/virtualization/index.js'
    import type { DataGridProps } from '../datagrid.types.js'
    import GridBody from './GridBody.svelte'
    import GridColumnChooser from '../chrome/GridColumnChooser.svelte'
    import GridContextMenu from '../menus/GridContextMenu.svelte'
    import GridDensityToggle from '../chrome/GridDensityToggle.svelte'
    import GridFilterChips from '../chrome/GridFilterChips.svelte'
    import GridHeader from './GridHeader.svelte'
    import GridPagination from '../chrome/GridPagination.svelte'
    import GridQuickFilter from '../chrome/GridQuickFilter.svelte'
    import GridRoot from './GridRoot.svelte'
    import GridStatusBar from '../chrome/GridStatusBar.svelte'
    import GridExportMenu from '../chrome/GridExportMenu.svelte'
    import GridToolbar from '../chrome/GridToolbar.svelte'
    import GridViewport from './GridViewport.svelte'

    let {
        grid: externalGrid,
        data,
        columns,
        getRowId,
        rowClass,
        pageSize,
        selection: selectionProp,
        editing: editingProp,
        virtual,
        density,
        toolbar = false,
        onExportAll,
        exportFilename,
        emptyText,
        loading,
        loadingRows,
        error,
        onRetry,
        fullWidthRow,
        persistState,
        ui,
        class: className
    }: DataGridProps<TRow> = $props()

    const grid = untrack(
        () =>
            externalGrid ??
            createDataGrid<TRow>({
                data,
                columns: columns ?? [],
                getRowId: getRowId!,
                rowClass,
                density,
                features: [
                    filtering<TRow>(),
                    sorting<TRow>(),
                    columnOps<TRow>(),
                    ...(selectionProp
                        ? [selection<TRow>(selectionProp === true ? undefined : selectionProp)]
                        : []),
                    ...(editingProp
                        ? [editing<TRow>(editingProp === true ? undefined : editingProp)]
                        : []),
                    virtual
                        ? virtualization<TRow>(virtual === true ? undefined : virtual)
                        : pagination<TRow>({ pageSize })
                ]
            })
    )

    const isVirtual = untrack(() => Boolean(getVirtualization(grid)))

    $effect.pre(() => {
        if (externalGrid) return
        grid.data = data ?? []
        grid.columns.defs = columns ?? []
    })
</script>

<GridRoot {grid} {persistState} {ui} class={isVirtual ? undefined : className}>
    {#if toolbar}
        <GridToolbar>
            <GridQuickFilter class="min-w-64" />
            <GridFilterChips />
            <div class="grow"></div>
            <GridExportMenu filename={exportFilename} {onExportAll} />
            <GridColumnChooser />
            <GridDensityToggle />
        </GridToolbar>
    {/if}
    <GridContextMenu {exportFilename}>
        <GridViewport class={isVirtual ? className : undefined}>
            <GridHeader />
            <GridBody {emptyText} {loading} {loadingRows} {error} {onRetry} {fullWidthRow} />
        </GridViewport>
    </GridContextMenu>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <GridStatusBar />
        <GridPagination />
    </div>
</GridRoot>
