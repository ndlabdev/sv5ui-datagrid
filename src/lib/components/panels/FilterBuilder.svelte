<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { SELECTION_COLUMN_ID } from '../../core/types/index.js'
    import { getAdvancedFilter } from '../../features/advanced-filter/advanced-filter.svelte.js'
    import {
        distinctValues,
        isFilterable,
        kindOf,
        opsFor
    } from '../../features/advanced-filter/operators.js'
    import type {
        AdvancedFilterOp,
        FilterCondition,
        FilterGroup,
        FilterNode
    } from '../../features/advanced-filter/advanced-filter.types.js'

    import FilterBuilderGroup from '../internal/FilterBuilderGroup.svelte'
    import { datagridVariants } from '../datagrid.variants.js'
    import type { GridState } from '$lib/index.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const theme = getGridTheme()
    const slots = datagridVariants()

    let {
        grid: gridProp,
        operators = [
            'contains',
            'notContains',
            'equals',
            'notEqual',
            'startsWith',
            'endsWith',
            'gt',
            'gte',
            'lt',
            'lte',
            'between',
            'before',
            'after',
            'in',
            'blank',
            'notBlank'
        ],
        debounce = 200,
        class: className
    }: {
        grid?: GridState<TRow>
        operators?: AdvancedFilterOp[]
        debounce?: number
        class?: string
    } = $props()

    const grid = untrack(() => gridProp) ?? getGridContext<TRow>()

    const MAX_SET_VALUES = 200

    const t = $derived(grid.labels)
    const filter = $derived(getAdvancedFilter(grid))

    const columnItems = $derived(
        grid.columns.all
            .filter((column) => column.id !== SELECTION_COLUMN_ID && isFilterable(column.def))
            .map((column) => ({ label: String(column.header ?? column.id), value: column.id }))
    )

    const kindFor = (columnId: string) => kindOf(grid.columns.get(columnId)?.def)

    const valuesFor = (columnId: string) => {
        const column = grid.columns.get(columnId)
        if (!column) return []

        const nodes = grid.preWindowNodes
        return distinctValues(
            (index) => grid.getValue(nodes[index]!, column, 'facet'),
            nodes.length,
            MAX_SET_VALUES
        ).map((value) => ({ label: value, value }))
    }

    function replace(node: FilterGroup, path: number[], next: FilterNode | null): FilterGroup {
        if (path.length === 0) return node

        const [head, ...rest] = path
        const children = node.children.flatMap((child, index) => {
            if (index !== head) return [child]
            if (rest.length === 0) return next ? [next] : []
            return child.kind === 'group' ? [replace(child, rest, next)] : [child]
        })
        return { ...node, children }
    }

    function update(path: number[], next: FilterNode | null) {
        const model = filter?.model
        if (!model) return
        filter?.setModel(
            path.length === 0 && next?.kind === 'group' ? next : replace(model, path, next)
        )
    }

    const newCondition = (): FilterCondition => {
        const columnId = columnItems[0]?.value ?? ''
        const allowed = opsFor(kindFor(columnId)).filter((op) => operators.includes(op))
        return {
            kind: 'condition',
            columnId,
            op: allowed[0] ?? operators[0] ?? 'contains',
            value: ''
        }
    }

    function addTo(path: number[], node: FilterNode) {
        const model = filter?.model
        if (!model) return

        const target = path.reduce<FilterNode | undefined>(
            (current, index) => (current?.kind === 'group' ? current.children[index] : undefined),
            model
        )
        const group = path.length === 0 ? model : target
        if (group?.kind !== 'group') return

        const grown: FilterGroup = { ...group, children: [...group.children, node] }
        filter?.setModel(path.length === 0 ? grown : replace(model, path, grown))
    }
</script>

{#if filter}
    <div
        data-dg-filter-panel
        class={slots.filterBuilder({ class: [theme('filterBuilder'), className] })}
    >
        <div class={slots.filterBuilderGroupHeader({ class: theme('filterBuilderGroupHeader') })}>
            <span class="text-sm font-medium text-on-surface">{t.filterTitle}</span>
            {#if grid.rowModel === 'server'}
                <span class={slots.filterBuilderHint({ class: theme('filterBuilderHint') })}
                    >{t.filterServerHandled}</span
                >
            {/if}
        </div>

        {#if filter.model.children.length === 0}
            <p class={slots.filterBuilderHint({ class: theme('filterBuilderHint') })}>
                {t.filterEmpty}
            </p>
        {/if}

        <FilterBuilderGroup
            labels={grid.labels}
            group={filter.model}
            path={[]}
            {columnItems}
            {kindFor}
            {valuesFor}
            locale={grid.locale ?? 'en-US'}
            {debounce}
            onUpdate={update}
            onAdd={addTo}
            addCondition={newCondition}
        />
    </div>
{/if}
