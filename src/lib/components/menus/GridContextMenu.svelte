<script lang="ts">
    import { ContextMenu, type ContextMenuItem } from 'sv5ui'
    import type { RowNode } from '../../core/types/index.js'
    import { getSelection } from '../../features/selection/index.js'
    import type { GridContextMenuProps } from '../datagrid.types.js'
    import { getGridContext } from '../internal/context.js'

    let { exportFilename, children }: GridContextMenuProps = $props()

    const grid = getGridContext()
    const labels = $derived(grid.labels)
    const selectionState = getSelection(grid)
    const hasItems = Boolean(selectionState || grid.features.some((feature) => feature.menuItems))

    let menuNode = $state.raw<RowNode<unknown> | null>(null)

    // The source set is unfiltered, so it covers pinned rows too — they are
    // lifted out of the pipeline downstream, not out of the source.
    function captureNode(event: MouseEvent) {
        const id = (event.target as HTMLElement | null)
            ?.closest('[data-dg-row-id]')
            ?.getAttribute('data-dg-row-id')
        menuNode = id === undefined || id === null ? null : (grid.nodeById(id) ?? null)
    }

    function selectionItems(): ContextMenuItem[] {
        if (!selectionState) return []
        const none = selectionState.count === 0
        return [
            {
                label: labels.copy,
                icon: 'lucide:copy',
                disabled: none,
                onSelect: () => void selectionState.copySelection()
            },
            {
                label: labels.copyWithHeaders,
                icon: 'lucide:copy-plus',
                disabled: none,
                onSelect: () => void selectionState.copySelection({ headers: true })
            },
            { type: 'separator' },
            {
                label: labels.exportCsv,
                icon: 'lucide:download',
                onSelect: () => selectionState.exportCsv({ filename: exportFilename })
            },
            { type: 'separator' },
            {
                label: labels.clearSelection,
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
