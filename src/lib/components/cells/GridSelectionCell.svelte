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

    // The checkbox is a fraction of the cell holding it, and a column of
    // checkboxes is where a user aims casually. The span fills the cell —
    // the negative margins take back its padding — and toggles from anywhere
    // the checkbox itself did not already handle. Only the body cell pads
    // vertically; the header sizes to the row and stretching is enough.
    const hitArea = '-mx-3 flex grow items-center justify-center self-stretch'
    const rowHitArea = `${hitArea} -my-(--dg-cell-py)`

    let shift = false

    function rememberModifiers(event: MouseEvent) {
        shift = event.shiftKey
        setTimeout(() => (shift = false), 0)
    }

    /** True once the checkbox has taken the click, directly or via its label. */
    function onControl(event: MouseEvent): boolean {
        return Boolean((event.target as HTMLElement | null)?.closest('[role="checkbox"], label'))
    }

    function onRowChecked() {
        if (!node) return
        selectionState?.toggleWithModifiers(node.id, { shift })
        shift = false
    }

    function onRowCellClick(event: MouseEvent) {
        if (!node || !selectable || onControl(event)) return
        selectionState?.toggleWithModifiers(node.id, { shift: event.shiftKey })
    }

    function onHeaderCellClick(event: MouseEvent) {
        if (onControl(event)) return
        selectionState?.toggleAll()
    }
</script>

{#if selectionState}
    {#if node}
        <!-- The span is a hit area, not a control: the checkbox inside it keeps
             the role and the name, and the keyboard reaches it through the
             cell's roving tabindex and the Space keybinding. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
            use:notTabbable
            onclickcapture={rememberModifiers}
            onclick={onRowCellClick}
            class="{rowHitArea} {selectable ? 'cursor-pointer' : ''}"
        >
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
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span use:notTabbable onclick={onHeaderCellClick} class="{hitArea} cursor-pointer">
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
