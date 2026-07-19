<script lang="ts">
    import { ContextMenu, type ContextMenuItem } from 'sv5ui'
    import { getSelection } from '../features/selection/index.js'
    import type { GridContextMenuProps } from './datagrid.types.js'
    import { getGridContext } from './context.js'

    let { exportFilename, children }: GridContextMenuProps = $props()

    const grid = getGridContext()
    const selectionState = getSelection(grid)

    const items: ContextMenuItem[] = $derived.by(() => {
        if (!selectionState) return []
        const none = selectionState.count === 0
        return [
            {
                label: 'Copy',
                icon: 'lucide:copy',
                disabled: none,
                onSelect: () => void selectionState.copySelection()
            },
            {
                label: 'Copy with headers',
                icon: 'lucide:copy-plus',
                disabled: none,
                onSelect: () => void selectionState.copySelection({ headers: true })
            },
            { type: 'separator' },
            {
                label: 'Export CSV',
                icon: 'lucide:download',
                onSelect: () => selectionState.exportCsv({ filename: exportFilename })
            },
            { type: 'separator' },
            {
                label: 'Clear selection',
                icon: 'lucide:x',
                disabled: none,
                onSelect: selectionState.clear
            }
        ]
    })
</script>

{#if selectionState}
    <ContextMenu {items}>
        {@render children?.()}
    </ContextMenu>
{:else}
    {@render children?.()}
{/if}
