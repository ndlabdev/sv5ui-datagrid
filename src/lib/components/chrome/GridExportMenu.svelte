<script lang="ts">
    import { Button, DropdownMenu, type DropdownMenuItem } from 'sv5ui'
    import { getSelection } from '../../features/selection/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridExportMenuProps } from '../datagrid.types.js'

    let { filename, class: className }: GridExportMenuProps = $props()

    const grid = getGridContext()
    const labels = $derived(grid.labels)
    const selectionState = getSelection(grid)

    const items = $derived.by<DropdownMenuItem[]>(() => {
        if (!selectionState) return []
        return [
            {
                label: labels.exportAllRows,
                icon: 'lucide:table',
                // Everything the filter left, not just the page on screen.
                onSelect: () => selectionState.exportCsv({ filename, allRows: true })
            },
            {
                label: labels.exportSelectedRows,
                icon: 'lucide:list-checks',
                disabled: selectionState.count === 0,
                onSelect: () => selectionState.exportCsv({ filename })
            }
        ]
    })
</script>

<!-- Export lives on the selection feature, so without it there is nothing to
     offer and the button would only ever be dead. -->
{#if selectionState}
    <DropdownMenu {items}>
        {#snippet children({ props })}
            <Button
                {...props}
                variant="outline"
                size="sm"
                icon="lucide:download"
                aria-label={labels.exportCsv}
                class={className}
            />
        {/snippet}
    </DropdownMenu>
{/if}
