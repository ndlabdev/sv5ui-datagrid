<script lang="ts" generics="TRow">
    import { Checkbox } from 'sv5ui'
    import type { RowNode } from '../../core/types/index.js'
    import { getSelection } from '../../features/selection/index.js'
    import { getGridContext } from '../internal/context.js'
    import { notTabbable } from '../internal/focus.js'

    let { node }: { node?: RowNode<TRow> } = $props()

    const grid = getGridContext<TRow>()
    const selectionState = getSelection(grid)

    const selectable = $derived(
        node !== undefined &&
            selectionState !== undefined &&
            selectionState.isRowSelectable(node.row)
    )

    let shift = false

    function rememberModifiers(event: MouseEvent) {
        shift = event.shiftKey
        setTimeout(() => (shift = false), 0)
    }

    function onRowChecked() {
        if (!node) return
        selectionState?.toggleWithModifiers(node.id, { shift })
        shift = false
    }
</script>

{#if selectionState}
    {#if node}
        <span use:notTabbable onclickcapture={rememberModifiers} class="contents">
            <Checkbox
                checked={selectionState.isSelected(node.id)}
                onCheckedChange={onRowChecked}
                disabled={!selectable}
                label={grid.labels.selectRow(node.index + 1)}
                ui={{ label: 'sr-only', wrapper: 'ms-0 me-0' }}
            />
        </span>
    {:else if selectionState.mode === 'multiple'}
        <!-- Out of the tab order like every other control in the grid: the
             cells carry the roving tabindex, and Space on the focused cell is
             what toggles. Tabbable checkboxes made a thousand-row grid a
             thousand tab stops. -->
        <span use:notTabbable class="contents">
            <Checkbox
                checked={selectionState.allState === 'all'}
                indeterminate={selectionState.allState === 'some'}
                onCheckedChange={selectionState.toggleAll}
                label={grid.labels.selectAllRows}
                ui={{ label: 'sr-only', wrapper: 'ms-0 me-0' }}
            />
        </span>
    {/if}
{/if}
