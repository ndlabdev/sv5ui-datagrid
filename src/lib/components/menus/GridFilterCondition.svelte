<script lang="ts">
    import { Input, Select } from 'sv5ui'
    import { DATE_OPS, NUMBER_OPS, TEXT_OPS } from '../../core/interaction/index.js'
    import { isPresenceOp } from '../../features/filtering/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridFilterConditionProps } from '../datagrid.types.js'

    let { type, condition, ordinal }: GridFilterConditionProps = $props()

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

    const inputType = $derived(type === 'number' ? 'number' : type === 'date' ? 'date' : 'text')
    const needsValue = $derived(!isPresenceOp(condition.op))
</script>

<Select {items} bind:value={condition.op} aria-label={labels.filterOperator(ordinal)} />
{#if needsValue}
    <Input
        type={inputType}
        placeholder={type === 'text' ? labels.valuePlaceholder : undefined}
        aria-label={labels.filterValue(ordinal)}
        bind:value={condition.value}
    />
    {#if condition.op === 'between'}
        <Input
            type={type === 'number' ? 'number' : 'date'}
            placeholder={labels.upperBoundPlaceholder}
            aria-label={labels.filterUpperBound(ordinal)}
            bind:value={condition.to}
        />
    {/if}
{/if}
