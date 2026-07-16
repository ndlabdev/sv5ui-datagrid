<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { createDataGrid } from '../core/grid.svelte.js'
    import { filtering } from '../features/filtering/index.js'
    import { pagination } from '../features/pagination/index.js'
    import { sorting } from '../features/sorting/index.js'
    import { getVirtualization, virtualization } from '../features/virtualization/index.js'
    import type { DataGridProps } from './datagrid.types.js'
    import GridBody from './GridBody.svelte'
    import GridDensityToggle from './GridDensityToggle.svelte'
    import GridHeader from './GridHeader.svelte'
    import GridPagination from './GridPagination.svelte'
    import GridQuickFilter from './GridQuickFilter.svelte'
    import GridRoot from './GridRoot.svelte'
    import GridToolbar from './GridToolbar.svelte'
    import GridViewport from './GridViewport.svelte'

    let {
        grid: externalGrid,
        data,
        columns,
        getRowId,
        pageSize,
        virtual,
        density,
        toolbar = false,
        emptyText,
        loading,
        error,
        onRetry,
        class: className
    }: DataGridProps<TRow> = $props()

    const grid = untrack(
        () =>
            externalGrid ??
            createDataGrid<TRow>({
                data,
                columns: columns ?? [],
                getRowId: getRowId!,
                density,
                features: virtual
                    ? [
                          filtering<TRow>(),
                          sorting<TRow>(),
                          virtualization<TRow>(virtual === true ? undefined : virtual)
                      ]
                    : [filtering<TRow>(), sorting<TRow>(), pagination<TRow>({ pageSize })]
            })
    )

    const isVirtual = untrack(() => Boolean(getVirtualization(grid)))

    $effect.pre(() => {
        if (externalGrid) return
        grid.data = data ?? []
        grid.columns.defs = columns ?? []
    })
</script>

<GridRoot {grid} class={isVirtual ? undefined : className}>
    {#if toolbar}
        <GridToolbar>
            <GridQuickFilter class="min-w-64" />
            <div class="grow"></div>
            <GridDensityToggle />
        </GridToolbar>
    {/if}
    <GridViewport class={isVirtual ? className : undefined}>
        <GridHeader />
        <GridBody {emptyText} {loading} {error} {onRetry} />
    </GridViewport>
    <GridPagination />
</GridRoot>
