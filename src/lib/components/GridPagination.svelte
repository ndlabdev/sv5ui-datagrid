<script lang="ts">
    import { Pagination, Select } from 'sv5ui'
    import { getPagination } from '../features/pagination/index.js'
    import { getGridContext } from './context.js'
    import type { GridPaginationProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { pageSizes = [10, 25, 50, 100], class: className }: GridPaginationProps = $props()

    const grid = getGridContext()
    const pagination = getPagination(grid)
    const slots = datagridVariants()

    const sizeItems = $derived(
        pageSizes.map((size) => ({ label: `${size} / page`, value: String(size) }))
    )
    const rangeStart = $derived(
        pagination?.pageSize ? (pagination.page - 1) * pagination.pageSize + 1 : 1
    )
    const total = $derived(pagination?.total ?? grid.totalRows)
    const rangeEnd = $derived(
        pagination?.pageSize ? Math.min(pagination.page * pagination.pageSize, total) : total
    )
</script>

{#if pagination && pagination.pageSize && total > 0}
    <div class={slots.footer({ class: className })}>
        <span class="text-xs text-on-surface-variant">
            {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()}
        </span>
        <div class="flex items-center gap-2">
            <Select
                items={sizeItems}
                aria-label="Rows per page"
                bind:value={
                    () => String(pagination.pageSize),
                    (value) => pagination.setPageSize(Number(value))
                }
            />
            {#if total > pagination.pageSize}
                <Pagination
                    {total}
                    itemsPerPage={pagination.pageSize}
                    bind:page={() => pagination.page, (page) => pagination.setPage(page)}
                />
            {/if}
        </div>
    </div>
{/if}
