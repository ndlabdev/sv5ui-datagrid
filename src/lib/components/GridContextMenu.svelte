<script lang="ts">
    import { ContextMenu, type ContextMenuItem } from 'sv5ui'
    import type { RowNode } from '../core/types.js'
    import { getRowPinning } from '../features/row-pinning/index.js'
    import { getSelection } from '../features/selection/index.js'
    import type { GridContextMenuProps } from './datagrid.types.js'
    import { getGridContext } from './context.js'

    let { exportFilename, children }: GridContextMenuProps = $props()

    const grid = getGridContext()
    const selectionState = getSelection(grid)
    const pinning = getRowPinning(grid)
    const hasItems = Boolean(selectionState || grid.features.some((feature) => feature.menuItems))

    let menuNode = $state.raw<RowNode<unknown> | null>(null)

    function captureNode(event: MouseEvent) {
        const id = (event.target as HTMLElement | null)
            ?.closest('[data-dg-row-id]')
            ?.getAttribute('data-dg-row-id')
        menuNode = id === undefined || id === null ? null : (findNode(id) ?? null)
    }

    function findNode(id: string): RowNode<unknown> | undefined {
        return (
            grid.preWindowNodes.find((node) => node.id === id) ??
            pinning?.topNodes.find((node) => node.id === id) ??
            pinning?.bottomNodes.find((node) => node.id === id)
        )
    }

    function selectionItems(): ContextMenuItem[] {
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
    }

    function featureItems(): ContextMenuItem[] {
        const node = menuNode ?? undefined
        return grid.features.flatMap((feature) =>
            (feature.menuItems?.({ grid, node }) ?? []).map((item): ContextMenuItem => ({
                label: item.label,
                icon: item.icon,
                disabled: item.disabled,
                onSelect: item.onSelect
            }))
        )
    }

    const items: ContextMenuItem[] = $derived.by(() => {
        const selection = selectionItems()
        const features = featureItems()
        if (selection.length === 0) return features
        if (features.length === 0) return selection
        return [...selection, { type: 'separator' }, ...features]
    })
</script>

{#if hasItems}
    <ContextMenu {items}>
        <div class="contents" oncontextmenucapture={captureNode}>
            {@render children?.()}
        </div>
    </ContextMenu>
{:else}
    {@render children?.()}
{/if}
