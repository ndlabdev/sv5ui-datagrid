<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import {
        type ColumnState,
        type PinnedSide,
        SELECTION_COLUMN_ID
    } from '../../core/types/index.js'
    import { Button, Checkbox, DropdownMenu, Input, Select, Tabs } from 'sv5ui'
    import { getGrouping } from '../../features/grouping/grouping.svelte.js'
    import type { Aggregation } from '../../features/grouping/grouping.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import type { GridState } from '$lib/index.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const theme = getGridTheme()
    const slots = datagridVariants()

    type Tab = 'columns' | 'group' | 'values'

    const NO_AGGREGATION = 'none'

    let {
        grid: gridProp,
        tabs = ['columns', 'group', 'values'],
        aggregations = ['sum', 'avg', 'count', 'min', 'max', 'median', 'distinctCount'],
        collapsed = $bindable(false),
        class: className
    }: {
        grid?: GridState<TRow>
        tabs?: Tab[]
        aggregations?: Aggregation<TRow>[]
        collapsed?: boolean
        class?: string
    } = $props()

    const grid = untrack(() => gridProp) ?? getGridContext<TRow>()

    const t = $derived(grid.labels)
    const grouping = $derived(getGrouping(grid))

    let chosen = $state<Tab | null>(null)

    const groupsClientSide = $derived(grouping !== undefined && grid.rowModel !== 'server')
    const offered = $derived(tabs.filter((name) => name === 'columns' || groupsClientSide))
    const tab = $derived(chosen && offered.includes(chosen) ? chosen : (offered[0] ?? 'columns'))
    let query = $state('')

    const columns = $derived(grid.columns.all.filter((column) => column.id !== SELECTION_COLUMN_ID))

    const matching = $derived(
        columns.filter((column) =>
            String(column.header ?? column.id)
                .toLowerCase()
                .includes(query.trim().toLowerCase())
        )
    )

    const groupable = $derived(matching.filter((column) => !grouping?.isGroupedBy(column.id)))
    const grouped = $derived(
        (grouping?.by ?? [])
            .map((columnId) => grid.columns.get(columnId))
            .filter((column) => column)
    )

    const tabLabel = (name: Tab) =>
        name === 'columns'
            ? t.toolPanelColumns
            : name === 'group'
              ? t.toolPanelGroup
              : t.toolPanelValues

    function setHidden(column: ColumnState<TRow>, hidden: boolean) {
        const setColumnHidden = grid.api.setColumnHidden as
            ((id: string, next: boolean) => void) | undefined
        setColumnHidden?.(column.id, hidden)
    }

    function showAll(hidden: boolean) {
        for (const column of matching) setHidden(column, hidden)
    }

    function pin(column: ColumnState<TRow>, side: PinnedSide | null) {
        const pinColumn = grid.api.pinColumn as
            ((id: string, next: PinnedSide | null) => void) | undefined
        pinColumn?.(column.id, column.pinned === side ? null : side)
    }

    function move(column: ColumnState<TRow>, delta: number) {
        const moveColumn = grid.api.moveColumn as ((id: string, to: number) => void) | undefined
        const at = grid.columns.visible.findIndex((candidate) => candidate.id === column.id)
        if (at < 0) return
        moveColumn?.(column.id, Math.max(0, Math.min(grid.columns.visible.length - 1, at + delta)))
    }

    function aggregationOf(columnId: string): string {
        const current = grouping?.aggregations[columnId]
        return typeof current === 'string' ? current : NO_AGGREGATION
    }

    function setAggregation(columnId: string, next: string) {
        grouping?.setAggregation(
            columnId,
            next === NO_AGGREGATION ? null : (next as Aggregation<TRow>)
        )
    }

    function actionsFor(column: ColumnState<TRow>) {
        const name = String(column.header ?? column.id)
        return [
            {
                label:
                    column.pinned === 'left'
                        ? t.commandUnpinColumn(name)
                        : t.commandPinColumnLeft(name),
                icon: 'lucide:pin',
                onSelect: () => pin(column, 'left')
            },
            {
                label:
                    column.pinned === 'right'
                        ? t.commandUnpinColumn(name)
                        : t.commandPinColumnRight(name),
                icon: 'lucide:pin',
                onSelect: () => pin(column, 'right')
            },
            {
                label: t.toolPanelMoveUp(name),
                icon: 'lucide:arrow-up',
                onSelect: () => move(column, -1)
            },
            {
                label: t.toolPanelMoveDown(name),
                icon: 'lucide:arrow-down',
                onSelect: () => move(column, 1)
            }
        ]
    }

    const aggregationItems = $derived([
        { label: t.toolPanelNoAggregation, value: NO_AGGREGATION },
        ...aggregations
            .filter((aggregation) => typeof aggregation === 'string')
            .map((aggregation) => ({ label: String(aggregation), value: String(aggregation) }))
    ])
</script>

{#if collapsed}
    <div
        data-dg-tool-panel
        class={slots.toolPanelCollapsed({ class: [theme('toolPanelCollapsed'), className] })}
    >
        <span class={slots.toolPanelTitle({ class: theme('toolPanelTitle') })}
            >{t.toolPanelTitle}</span
        >
        <Button
            variant="ghost"
            size="xs"
            icon="lucide:panel-left-open"
            aria-label={t.toolPanelExpand}
            onclick={() => (collapsed = false)}
        />
    </div>
{:else}
    <div data-dg-tool-panel class={slots.toolPanel({ class: [theme('toolPanel'), className] })}>
        <div class={slots.toolPanelHeader({ class: theme('toolPanelHeader') })}>
            <span class={slots.toolPanelTitle({ class: theme('toolPanelTitle') })}
                >{t.toolPanelTitle}</span
            >
            <Button
                variant="ghost"
                size="xs"
                icon="lucide:panel-left-close"
                aria-label={t.toolPanelCollapse}
                onclick={() => (collapsed = true)}
            />
        </div>

        <div class={slots.toolPanelTabs({ class: theme('toolPanelTabs') })}>
            <Tabs
                items={offered.map((name) => ({ value: name, label: tabLabel(name) }))}
                value={tab}
                onValueChange={(next: string) => (chosen = next as Tab)}
            />
        </div>

        <Input bind:value={query} placeholder={t.toolPanelSearch} aria-label={t.toolPanelSearch} />

        <div class={slots.toolPanelBody({ class: theme('toolPanelBody') })}>
            {#if matching.length === 0}
                <p class={slots.toolPanelHint({ class: theme('toolPanelHint') })}>
                    {t.toolPanelEmpty}
                </p>
            {:else if tab === 'columns'}
                <div class="flex gap-1">
                    <Button
                        variant="outline"
                        size="xs"
                        label={t.toolPanelShowAll}
                        onclick={() => showAll(false)}
                    />
                    <Button
                        variant="outline"
                        size="xs"
                        label={t.toolPanelHideAll}
                        onclick={() => showAll(true)}
                    />
                </div>
                {#each matching as column (column.id)}
                    <div
                        data-dg-tool-column={column.id}
                        class={`${slots.toolPanelRow({ class: theme('toolPanelRow') })} ${column.hidden ? slots.toolPanelRowMuted({ class: theme('toolPanelRowMuted') }) : ''}`}
                    >
                        <Checkbox
                            checked={!column.hidden}
                            label={String(column.header ?? column.id)}
                            class={slots.toolPanelRowLabel({ class: theme('toolPanelRowLabel') })}
                            onCheckedChange={(next: boolean) => setHidden(column, !next)}
                        />
                        {#if column.pinned}
                            <span
                                class={slots.toolPanelPinMark({ class: theme('toolPanelPinMark') })}
                                >{column.pinned}</span
                            >
                        {/if}
                        <DropdownMenu items={actionsFor(column)}>
                            {#snippet children({ props }: { props: Record<string, unknown> })}
                                <Button
                                    {...props}
                                    variant="ghost"
                                    size="xs"
                                    icon="lucide:ellipsis-vertical"
                                    aria-label={t.toolPanelActions(
                                        String(column.header ?? column.id)
                                    )}
                                />
                            {/snippet}
                        </DropdownMenu>
                    </div>
                {/each}
            {:else if tab === 'group'}
                {#if grouped.length > 0}
                    {#each grouped as column (column!.id)}
                        <div
                            data-dg-tool-grouped={column!.id}
                            class={slots.toolPanelRow({ class: theme('toolPanelRow') })}
                        >
                            <span
                                class={slots.toolPanelRowLabel({
                                    class: theme('toolPanelRowLabel')
                                })}>{column!.header ?? column!.id}</span
                            >
                            <Button
                                variant="ghost"
                                size="xs"
                                icon="lucide:x"
                                aria-label={t.removeGroup(String(column!.header ?? column!.id))}
                                onclick={() => grouping?.ungroup(column!.id)}
                            />
                        </div>
                    {/each}
                {:else}
                    <p class={slots.toolPanelHint({ class: theme('toolPanelHint') })}>
                        {t.groupPanelEmpty}
                    </p>
                {/if}
                {#each groupable as column (column.id)}
                    <div
                        data-dg-tool-groupable={column.id}
                        class={slots.toolPanelRow({ class: theme('toolPanelRow') })}
                    >
                        <span class={slots.toolPanelRowLabel({ class: theme('toolPanelRowLabel') })}
                            >{column.header ?? column.id}</span
                        >
                        <Button
                            variant="ghost"
                            size="xs"
                            icon="lucide:plus"
                            aria-label={t.groupByColumn}
                            onclick={() => grouping?.groupBy(column.id)}
                        />
                    </div>
                {/each}
            {:else}
                {#each matching as column (column.id)}
                    <div
                        data-dg-tool-value={column.id}
                        class={slots.toolPanelValueRow({ class: theme('toolPanelValueRow') })}
                    >
                        <span class={slots.toolPanelRowLabel({ class: theme('toolPanelRowLabel') })}
                            >{column.header ?? column.id}</span
                        >
                        <Select
                            items={aggregationItems}
                            placeholder={t.toolPanelNoAggregation}
                            bind:value={
                                () => aggregationOf(column.id),
                                (next) => setAggregation(column.id, String(next))
                            }
                            aria-label={String(column.header ?? column.id)}
                        />
                    </div>
                {/each}
            {/if}
        </div>
    </div>
{/if}
