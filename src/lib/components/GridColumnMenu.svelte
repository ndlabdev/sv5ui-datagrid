<script lang="ts" generics="TRow">
    import { Button, DropdownMenu } from 'sv5ui'
    import { getColumnOps } from '../features/column-ops/index.js'
    import { getSorting } from '../features/sorting/index.js'
    import { getGridContext } from './context.js'
    import type { GridColumnMenuProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { column }: GridColumnMenuProps<TRow> = $props()

    const grid = getGridContext<TRow>()
    const columnOps = getColumnOps(grid)!
    const sorting = getSorting(grid)
    const slots = datagridVariants()

    interface MenuEntry {
        label: string
        icon: string
        onSelect: () => void
    }

    const items = $derived.by<MenuEntry[]>(() => {
        const list: MenuEntry[] = []
        if (sorting && column.def.sortable) {
            list.push(
                {
                    label: 'Sort ascending',
                    icon: 'lucide:arrow-up-narrow-wide',
                    onSelect: () => sorting.setSort([{ columnId: column.id, direction: 'asc' }])
                },
                {
                    label: 'Sort descending',
                    icon: 'lucide:arrow-down-wide-narrow',
                    onSelect: () => sorting.setSort([{ columnId: column.id, direction: 'desc' }])
                },
                {
                    label: 'Clear sort',
                    icon: 'lucide:circle-x',
                    onSelect: () => sorting.setSort([])
                }
            )
        }
        if (columnOps.canPin) {
            if (column.pinned !== 'left') {
                list.push({
                    label: 'Pin left',
                    icon: 'lucide:arrow-left-to-line',
                    onSelect: () => columnOps.pinColumn(column.id, 'left')
                })
            }
            if (column.pinned !== 'right') {
                list.push({
                    label: 'Pin right',
                    icon: 'lucide:arrow-right-to-line',
                    onSelect: () => columnOps.pinColumn(column.id, 'right')
                })
            }
            if (column.pinned) {
                list.push({
                    label: 'Unpin',
                    icon: 'lucide:pin-off',
                    onSelect: () => columnOps.pinColumn(column.id, null)
                })
            }
        }
        if (columnOps.canResize) {
            list.push({
                label: 'Autosize',
                icon: 'lucide:move-horizontal',
                onSelect: () => columnOps.autoSizeColumn(column.id)
            })
        }
        if (columnOps.canHide) {
            list.push({
                label: 'Hide column',
                icon: 'lucide:eye-off',
                onSelect: () => columnOps.setColumnHidden(column.id, true)
            })
        }
        return list
    })
</script>

{#if items.length > 0}
    <span data-dg-noreorder class={slots.menuButton()}>
        <DropdownMenu
            {items}
            bind:open={
                () => columnOps.menuFor === column.id,
                (open) => {
                    if (open) columnOps.menuFor = column.id
                    else if (columnOps.menuFor === column.id) columnOps.menuFor = null
                }
            }
        >
            {#snippet children({ props })}
                <Button
                    {...props}
                    variant="ghost"
                    size="xs"
                    icon="lucide:ellipsis-vertical"
                    aria-label={`${column.header} column menu`}
                    tabindex={-1}
                />
            {/snippet}
        </DropdownMenu>
    </span>
{/if}
