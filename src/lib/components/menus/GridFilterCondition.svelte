<script lang="ts">
    import { DatePicker, Input, Select } from 'sv5ui'
    import { DATE_OPS, NUMBER_OPS, TEXT_OPS } from '../../core/interaction/index.js'
    import { isPresenceOp } from '../../features/filtering/index.js'
    import { getGridContext } from '../internal/context.js'
    import { fromDateValue, toDateValue } from '../internal/editor-values.js'
    import type { GridFilterConditionProps } from '../datagrid.types.js'

    let { type, condition, ordinal, unit }: GridFilterConditionProps = $props()

    const grid = getGridContext()
    const labels = $derived(grid.labels)

    // Order lives with the operators, wording with the labels.
    const items = $derived.by(() => {
        if (type === 'text') return TEXT_OPS.map((op) => ({ label: labels.textOps[op], value: op }))
        if (type === 'number') {
            return NUMBER_OPS.map((op) => ({ label: labels.numberOps[op], value: op }))
        }
        return DATE_OPS.map((op) => ({ label: labels.dateOps[op], value: op }))
    })

    const inputType = $derived(type === 'number' ? 'number' : 'text')
    const needsValue = $derived(!isPresenceOp(condition.op))

    // The picker takes a label by id rather than an `aria-label`. One id per
    // component instance, so the pair is built from it.
    const fieldId = $props.id()
    const valueId = `${fieldId}-value`
    const upperId = `${fieldId}-to`
</script>

{#snippet unitSlot()}
    <span class="text-xs text-on-surface-variant">{unit}</span>
{/snippet}

<Select {items} bind:value={condition.op} aria-label={labels.filterOperator(ordinal)} />
{#if needsValue}
    {#if type === 'date'}
        <label class="sr-only" for={valueId}>{labels.filterValue(ordinal)}</label>
        <DatePicker
            id={valueId}
            locale={grid.locale}
            value={toDateValue(condition.value)}
            onValueChange={(next) => (condition.value = fromDateValue(next))}
        />
        {#if condition.op === 'between'}
            <label class="sr-only" for={upperId}>{labels.filterUpperBound(ordinal)}</label>
            <DatePicker
                id={upperId}
                locale={grid.locale}
                value={toDateValue(condition.to)}
                onValueChange={(next) => (condition.to = fromDateValue(next))}
            />
        {/if}
    {:else}
        <Input
            type={inputType}
            placeholder={type === 'text' ? labels.valuePlaceholder : undefined}
            aria-label={labels.filterValue(ordinal)}
            trailingSlot={unit ? unitSlot : undefined}
            bind:value={condition.value}
        />
        {#if condition.op === 'between'}
            <Input
                type={inputType}
                placeholder={labels.upperBoundPlaceholder}
                aria-label={labels.filterUpperBound(ordinal)}
                trailingSlot={unit ? unitSlot : undefined}
                bind:value={condition.to}
            />
        {/if}
    {/if}
{/if}
