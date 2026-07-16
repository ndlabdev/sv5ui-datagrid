<script lang="ts">
    import { Pagination } from 'sv5ui'
    import { getPagination } from '../features/pagination/index.js'
    import { getGridContext } from './context.js'
    import type { GridPaginationProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { class: className }: GridPaginationProps = $props()

    const grid = getGridContext()
    const pagination = getPagination(grid)
    const slots = datagridVariants()
</script>

{#if pagination && pagination.pageSize && grid.totalRows > pagination.pageSize}
    <div class={slots.footer({ class: className })}>
        <Pagination
            total={grid.totalRows}
            itemsPerPage={pagination.pageSize}
            bind:page={() => pagination.page, (page) => pagination.setPage(page)}
        />
    </div>
{/if}
