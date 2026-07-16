<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { createDataGrid } from '../core/grid.svelte.js'
    import { filtering } from '../features/filtering/index.js'
    import { pagination } from '../features/pagination/index.js'
    import { sorting } from '../features/sorting/index.js'
    import { getVirtualization, virtualization } from '../features/virtualization/index.js'
    import type { DataGridProps } from './datagrid.types.js'
    import GridBody from './GridBody.svelte'
    import GridHeader from './GridHeader.svelte'
    import GridPagination from './GridPagination.svelte'
    import GridRoot from './GridRoot.svelte'
    import GridViewport from './GridViewport.svelte'

    let {
        grid: externalGrid,
        data,
        columns,
        getRowId,
        pageSize,
        virtual,
        emptyText,
        class: className
    }: DataGridProps<TRow> = $props()

    const grid = untrack(
        () =>
            externalGrid ??
            createDataGrid<TRow>({
                data,
                columns: columns ?? [],
                getRowId: getRowId!,
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
    <GridViewport class={isVirtual ? className : undefined}>
        <GridHeader />
        <GridBody {emptyText} />
    </GridViewport>
    <GridPagination />
</GridRoot>
