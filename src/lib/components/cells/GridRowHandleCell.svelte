<script lang="ts" generics="TRow">
    import { Icon } from 'sv5ui'
    import type { RowNode } from '../../core/types/index.js'
    import { getRowReorder } from '../../features/row-reorder/index.js'
    import { getGridContext } from '../internal/context.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { beginRowDrag } from '../internal/row-drag.js'
    import { getGridTheme } from '../internal/theme.js'

    let { node, position }: { node: RowNode<TRow>; position: number } = $props()

    const grid = getGridContext<TRow>()
    const reorder = getRowReorder(grid)!
    const slots = datagridVariants()
    const theme = getGridTheme()

    const draggable = $derived(reorder.canDrag(node))
    const ghostClass = $derived(slots.rowGhost({ class: theme('rowGhost') }))

    function start(event: PointerEvent) {
        if (!draggable) return
        // A finger keeps its default until the hold completes, or the list
        // could not be scrolled from the grip.
        if (event.pointerType !== 'touch') event.preventDefault()
        beginRowDrag(event, {
            ghostClass,
            onStart: () => reorder.startDrag(node.id),
            onOver: (rowId) => {
                const index = grid.preWindowNodes.findIndex((candidate) => candidate.id === rowId)
                if (index >= 0) reorder.updateDrag(index)
            },
            onCommit: () => reorder.commitDrag(),
            onCancel: () => reorder.cancelDrag()
        })
    }
</script>

<button
    type="button"
    tabindex="-1"
    disabled={!draggable}
    aria-label={grid.labels.dragRow(position)}
    class={slots.rowHandle({ class: theme('rowHandle') })}
    onpointerdown={start}
>
    <Icon name="lucide:grip-vertical" class="size-4" />
</button>
