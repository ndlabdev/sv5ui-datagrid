<script lang="ts">
    import { Button, DropdownMenu, type DropdownMenuItem } from 'sv5ui'
    import { getSelection } from '../../features/selection/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridExportMenuProps } from '../datagrid.types.js'

    let { filename, onExportAll, class: className }: GridExportMenuProps = $props()

    const grid = getGridContext()
    const labels = $derived(grid.labels)
    const selectionState = getSelection(grid)

    /**
     * A server row model holds one page, so the grid has nothing to write for
     * the rest of the set and says so instead of writing a page under a name
     * that promises more. `onExportAll` is where the whole set comes from: an
     * endpoint that streams the file, which is the only thing that scales to
     * the row counts a server model exists for.
     */
    const holdsEverything = $derived(grid.rowModel !== 'server' || onExportAll !== undefined)

    const items = $derived.by<DropdownMenuItem[]>(() => {
        if (!selectionState) return []
        return [
            {
                label: holdsEverything ? labels.exportAllRows : labels.exportLoadedRows,
                icon: 'lucide:table',
                // Everything the filter left, not just the page on screen.
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
