<script lang="ts" generics="TRow">
    import { Button, DropdownMenu } from 'sv5ui'
    import { getColumnOps } from '../../features/column-ops/index.js'
    import { filterTypeOf, getFiltering } from '../../features/filtering/index.js'
    import { getSorting } from '../../features/sorting/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridColumnMenuProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'

    let { column }: GridColumnMenuProps<TRow> = $props()

    const grid = getGridContext<TRow>()
    const columnOps = getColumnOps(grid)!
    const sorting = getSorting(grid)
    const filteringState = getFiltering(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

    interface MenuEntry {
        label: string
        icon: string
        onSelect: () => void
    }

    function sortItems(): MenuEntry[] {
        if (!sorting || !column.def.sortable) return []
        return [
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
            { label: 'Clear sort', icon: 'lucide:circle-x', onSelect: () => sorting.setSort([]) }
        ]
    }

    function pinItems(): MenuEntry[] {
        if (!columnOps.canPin) return []
        const list: MenuEntry[] = []
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
        return list
    }

    function actionItems(): MenuEntry[] {
        const list: MenuEntry[] = []
        if (filteringState && filterTypeOf(column.def)) {
            list.push({
                label: 'Filter…',
                icon: 'lucide:filter',
                onSelect: () => (filteringState.filterFor = column.id)
            })
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
    }

    const open = $derived(columnOps.menuFor === column.id)

    /** Cheap enough to evaluate per column, unlike the items themselves. */
    const hasItems = $derived(
        Boolean(sorting && column.def.sortable) ||
            columnOps.canPin ||
            columnOps.canResize ||
            columnOps.canHide ||
            Boolean(filteringState && filterTypeOf(column.def))
    )

    // Built only while open: every visible column mounts one of these.
    const items = $derived(open ? [...sortItems(), ...pinItems(), ...actionItems()] : [])
</script>

{#if hasItems}
    <span data-dg-noreorder class={slots.menuButton({ class: theme('menuButton') })}>
        <DropdownMenu
            {items}
            bind:open={
                () => open,
                (next) => {
                    if (next) columnOps.menuFor = column.id
                    else if (open) columnOps.menuFor = null
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
