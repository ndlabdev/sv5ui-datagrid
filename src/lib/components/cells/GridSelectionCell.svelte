<script lang="ts" generics="TRow">
    import { Checkbox } from 'sv5ui'
    import type { RowNode } from '../../core/types.js'
    import { getSelection } from '../../features/selection/index.js'
    import { getGridContext } from '../internal/context.js'

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
        <span onclickcapture={rememberModifiers} class="contents">
            <Checkbox
                checked={selectionState.isSelected(node.id)}
                onCheckedChange={onRowChecked}
                disabled={!selectable}
                label={`Select row ${node.index + 1}`}
                ui={{ label: 'sr-only' }}
            />
        </span>
    {:else if selectionState.mode === 'multiple'}
        <Checkbox
            checked={selectionState.allState === 'all'}
            indeterminate={selectionState.allState === 'some'}
            onCheckedChange={selectionState.toggleAll}
            label="Select all rows"
            ui={{ label: 'sr-only' }}
        />
    {/if}
{/if}
