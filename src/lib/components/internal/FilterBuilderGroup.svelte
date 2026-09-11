<script lang="ts">
    import { Button, DatePicker, Select } from 'sv5ui'
    import type {
        FilterCondition,
        FilterGroup,
        FilterNode
    } from '../../features/advanced-filter/advanced-filter.types.js'
    import {
        needsList,
        needsRange,
        needsValue,
        opForKind,
        opsFor,
        type FilterKind
    } from '../../features/advanced-filter/operators.js'
    import { fromDateValue, toDateValue } from './editor-values.js'

    import FilterValueInput from './FilterValueInput.svelte'
    import type { DataGridLabels } from '../../core/types/index.js'
    import FilterBuilderGroup from './FilterBuilderGroup.svelte'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from './theme.js'

    const theme = getGridTheme()
    const slots = datagridVariants()

    type Item = { label: string; value: string }

    let {
        labels,
        group,
        path,
        columnItems,
        kindFor,
        valuesFor,
        locale,
        debounce,
        onUpdate,
        onAdd,
        addCondition
    }: {
        labels: DataGridLabels
        group: FilterGroup
        path: number[]
        columnItems: Item[]
        kindFor: (columnId: string) => FilterKind
        valuesFor: (columnId: string) => Item[]
        locale: string
        debounce: number
        onUpdate: (path: number[], next: FilterNode | null) => void
        onAdd: (path: number[], node: FilterNode) => void
        addCondition: () => FilterCondition
    } = $props()

    const t = $derived(labels)
    const fieldId = $props.id()

    function patch(index: number, condition: FilterCondition, change: Partial<FilterCondition>) {
        onUpdate([...path, index], { ...condition, ...change })
    }

    function pickColumn(index: number, condition: FilterCondition, columnId: string) {
        const kind = kindFor(columnId)
        const op = opForKind(condition.op, kind)
        const same = op === condition.op
        patch(index, condition, {
            columnId,
            op,
            value: same ? condition.value : undefined,
            to: same ? condition.to : undefined,
            values: same ? condition.values : undefined
        })
    }

    const operatorsOf = (columnId: string): Item[] =>
        opsFor(kindFor(columnId)).map((op) => ({ label: t.filterOp(op), value: op }))
</script>

<div
    data-dg-filter-group={path.join('.')}
    class={slots.filterBuilderGroup({ class: theme('filterBuilderGroup') })}
>
    <div class={slots.filterBuilderGroupHeader({ class: theme('filterBuilderGroupHeader') })}>
        <Button
            variant={group.join === 'and' ? 'solid' : 'outline'}
            size="xs"
            label={t.filterJoin('and')}
            onclick={() => onUpdate(path, { ...group, join: 'and' })}
        />
        <Button
            variant={group.join === 'or' ? 'solid' : 'outline'}
            size="xs"
            label={t.filterJoin('or')}
            onclick={() => onUpdate(path, { ...group, join: 'or' })}
        />
        <Button
            variant={group.not === true ? 'solid' : 'ghost'}
            size="xs"
            label={t.filterNot}
            onclick={() => onUpdate(path, { ...group, not: group.not !== true })}
        />
        <div class="grow"></div>
        <Button
            variant="ghost"
            color="surface"
            size="xs"
            icon="lucide:plus"
            label={t.filterAddCondition}
            onclick={() => onAdd(path, addCondition())}
        />
        <Button
            variant="ghost"
            color="surface"
            size="xs"
            label={t.filterAddGroup}
            onclick={() => onAdd(path, { kind: 'group', join: 'and', children: [] })}
        />
        {#if path.length > 0}
            <Button
                variant="ghost"
                color="surface"
                size="xs"
                icon="lucide:x"
                aria-label={t.filterRemove}
                onclick={() => onUpdate(path, null)}
            />
        {/if}
    </div>

    {#each group.children as child, index (index)}
        {#if child.kind === 'group'}
            <FilterBuilderGroup
                {labels}
                group={child}
                path={[...path, index]}
                {columnItems}
                {kindFor}
                {valuesFor}
                {locale}
                {debounce}
                {onUpdate}
                {onAdd}
                {addCondition}
            />
        {:else}
            {@const kind = kindFor(child.columnId)}
            <div
                data-dg-filter-row={[...path, index].join('.')}
                data-dg-filter-kind={kind}
                class={slots.filterBuilderRow({ class: theme('filterBuilderRow') })}
            >
                <Select
                    items={columnItems}
                    class={slots.filterBuilderColumnSelect({
                        class: theme('filterBuilderColumnSelect')
                    })}
                    aria-label={t.filterBuilderColumn}
                    bind:value={
                        () => child.columnId, (next) => pickColumn(index, child, String(next))
                    }
                />
                <Select
                    items={operatorsOf(child.columnId)}
                    class={slots.filterBuilderOperatorSelect({
                        class: theme('filterBuilderOperatorSelect')
                    })}
                    aria-label={t.filterBuilderOperator}
                    bind:value={
                        () => child.op,
                        (next) => patch(index, child, { op: next as FilterCondition['op'] })
                    }
                />
                {#if needsList(child.op)}
                    <Select
                        multiple
                        items={valuesFor(child.columnId)}
                        class={slots.filterBuilderValueInput({
                            class: theme('filterBuilderValueInput')
                        })}
                        placeholder={t.filterBuilderValue}
                        ui={{
                            placeholder: slots.filterBuilderValuePlaceholder({
                                class: theme('filterBuilderValuePlaceholder')
                            })
                        }}
                        aria-label={t.filterBuilderValue}
                        bind:value={
                            () => (child.values ?? []).map(String),
                            (next) => patch(index, child, { values: next as string[] })
                        }
                    />
                {:else if kind === 'set' && needsValue(child.op)}
                    <Select
                        items={valuesFor(child.columnId)}
                        class={slots.filterBuilderValueInput({
                            class: theme('filterBuilderValueInput')
                        })}
                        placeholder={t.filterBuilderValue}
                        ui={{
                            placeholder: slots.filterBuilderValuePlaceholder({
                                class: theme('filterBuilderValuePlaceholder')
                            })
                        }}
                        aria-label={t.filterBuilderValue}
                        bind:value={
                            () => String(child.value ?? ''),
                            (next) => patch(index, child, { value: next })
                        }
                    />
                {:else if kind === 'boolean' && needsValue(child.op)}
                    <Select
                        items={[
                            { label: t.filterTrue, value: 'true' },
                            { label: t.filterFalse, value: 'false' }
                        ]}
                        class={slots.filterBuilderValueInput({
                            class: theme('filterBuilderValueInput')
                        })}
                        placeholder={t.filterBuilderValue}
                        ui={{
                            placeholder: slots.filterBuilderValuePlaceholder({
                                class: theme('filterBuilderValuePlaceholder')
                            })
                        }}
                        aria-label={t.filterBuilderValue}
                        bind:value={
                            () => (typeof child.value === 'boolean' ? String(child.value) : ''),
                            (next) => patch(index, child, { value: next === 'true' })
                        }
                    />
                {:else if kind === 'date' && needsValue(child.op)}
                    <label class="sr-only" for={`${fieldId}-${index}-value`}
                        >{t.filterBuilderValue}</label
                    >
                    <DatePicker
                        id={`${fieldId}-${index}-value`}
                        {locale}
                        class={slots.filterBuilderValueInput({
                            class: theme('filterBuilderValueInput')
                        })}
                        value={toDateValue(child.value)}
                        onValueChange={(next) =>
                            patch(index, child, { value: fromDateValue(next) })}
                    />
                    {#if needsRange(child.op)}
                        <label class="sr-only" for={`${fieldId}-${index}-to`}
                            >{t.filterValueTo}</label
                        >
                        <DatePicker
                            id={`${fieldId}-${index}-to`}
                            {locale}
                            class={slots.filterBuilderValueInput({
                                class: theme('filterBuilderValueInput')
                            })}
                            value={toDateValue(child.to)}
                            onValueChange={(next) =>
                                patch(index, child, { to: fromDateValue(next) })}
                        />
                    {/if}
                {:else if needsValue(child.op)}
                    <FilterValueInput
                        type={kind === 'number' ? 'number' : 'text'}
                        {debounce}
                        class={slots.filterBuilderValueInput({
                            class: theme('filterBuilderValueInput')
                        })}
                        placeholder={t.filterBuilderValue}
                        label={t.filterBuilderValue}
                        value={child.value}
                        onValue={(next) => patch(index, child, { value: next })}
                    />
                    {#if needsRange(child.op)}
                        <FilterValueInput
                            type={kind === 'number' ? 'number' : 'text'}
                            {debounce}
                            class={slots.filterBuilderValueInput({
                                class: theme('filterBuilderValueInput')
                            })}
                            placeholder={t.filterValueTo}
                            label={t.filterValueTo}
                            value={child.to}
                            onValue={(next) => patch(index, child, { to: next })}
                        />
                    {/if}
                {/if}
                <Button
                    variant="ghost"
                    color="surface"
                    size="xs"
                    icon="lucide:x"
                    aria-label={t.filterRemove}
                    onclick={() => onUpdate([...path, index], null)}
                />
            </div>
        {/if}
    {/each}
</div>
