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

    const hitArea = '-mx-3 flex grow items-center justify-center self-stretch'
    const rowHitArea = `${hitArea} -my-(--dg-cell-py)`

    let shift = false

    function rememberModifiers(event: MouseEvent) {
        shift = event.shiftKey
        setTimeout(() => (shift = false), 0)
    }

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
