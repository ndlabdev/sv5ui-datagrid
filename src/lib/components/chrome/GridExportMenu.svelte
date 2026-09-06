<script lang="ts">
    import { Button, DropdownMenu, type DropdownMenuItem } from 'sv5ui'
    import { getSelection } from '../../features/selection/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridExportMenuProps } from '../datagrid.types.js'

    let { filename, onExportAll, class: className }: GridExportMenuProps = $props()

    const grid = getGridContext()
    const labels = $derived(grid.labels)
    const selectionState = getSelection(grid)

    const holdsEverything = $derived(grid.rowModel !== 'server' || onExportAll !== undefined)

    const items = $derived.by<DropdownMenuItem[]>(() => {
        if (!selectionState) return []
        return [
            {
                label: holdsEverything ? labels.exportAllRows : labels.exportLoadedRows,
                icon: 'lucide:table',
                onSelect: () =>
                    onExportAll
                        ? onExportAll()
                        : selectionState.exportCsv({ filename, allRows: true })
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
