<script lang="ts">
    import { Button, DropdownMenu, type DropdownMenuItem } from 'sv5ui'
    import { getColumnOps } from '../../features/column-ops/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridColumnChooserProps } from '../datagrid.types.js'

    let { class: className }: GridColumnChooserProps = $props()

    const grid = getGridContext()
    const columnOps = getColumnOps(grid)

    const items = $derived.by<DropdownMenuItem[]>(() =>
        grid.columns.all.map((column) => ({
            type: 'checkbox' as const,
            label: column.header,
            checked: !column.hidden,
            closeOnSelect: false,
            disabled: !column.hidden && grid.columns.visible.length <= 1,
            onCheckedChange: (checked: boolean) => columnOps?.setColumnHidden(column.id, !checked)
        }))
    )
</script>

{#if columnOps?.canHide}
    <DropdownMenu {items}>
        {#snippet children({ props })}
            <Button
                {...props}
                variant="outline"
                size="sm"
                icon="lucide:columns-3"
                aria-label="Choose columns"
                class={className}
            />
        {/snippet}
    </DropdownMenu>
{/if}
