<script lang="ts">
    import { Button, DropdownMenu, type DropdownMenuItem } from 'sv5ui'
    import { isSyntheticColumn } from '../../core/types/index.js'
    import { getColumnOps } from '../../features/column-ops/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridColumnChooserProps } from '../datagrid.types.js'

    let { class: className }: GridColumnChooserProps = $props()

    const grid = getGridContext()
    const columnOps = getColumnOps(grid)

    const items = $derived.by<DropdownMenuItem[]>(() =>
        grid.columns.all
            // The grid's own checkbox and grip columns carry no header and
            // cannot be hidden, so they would only be blank rows in the list.
            .filter((column) => !isSyntheticColumn(column.id))
            .map((column) => ({
                type: 'checkbox' as const,
                label: column.header || column.id,
                checked: !column.hidden,
                closeOnSelect: false,
                disabled: !column.hidden && grid.columns.visible.length <= 1,
                onCheckedChange: (checked: boolean) =>
                    columnOps?.setColumnHidden(column.id, !checked)
            }))
    )
</script>

{#if columnOps?.canHide}
    <!-- A grid with forty columns makes a menu taller than the screen, which
         then has no way to reach its own end. -->
    <DropdownMenu {items} ui={{ content: 'max-h-[min(60vh,28rem)] overflow-y-auto' }}>
        {#snippet children({ props })}
            <Button
                {...props}
                variant="outline"
                size="sm"
                icon="lucide:columns-3"
                aria-label={grid.labels.chooseColumns}
                class={className}
            />
        {/snippet}
    </DropdownMenu>
{/if}
