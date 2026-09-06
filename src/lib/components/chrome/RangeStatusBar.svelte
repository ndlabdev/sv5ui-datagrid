<script lang="ts">
    import { aggregate } from '../../features/grouping/aggregate.js'
    import { getRangeSelection } from '../../features/range-selection/range-selection.svelte.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const grid = getGridContext()
    const theme = getGridTheme()
    const slots = datagridVariants()

    let {
        format = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        class: className
    }: {
        format?: (value: number) => string
        class?: string
    } = $props()

    const range = $derived(getRangeSelection(grid))
    const values = $derived(range?.selectedValues ?? [])
    const shape = $derived(range?.ranges.length === 1 ? range.shape : null)
    const t = $derived(grid.labels)

    const stats = $derived(
        values.length === 0
            ? null
            : [
                  { key: 'sum', label: t.rangeSum, value: aggregate('sum', values, values) },
                  { key: 'avg', label: t.rangeAvg, value: aggregate('avg', values, values) },
                  { key: 'min', label: t.rangeMin, value: aggregate('min', values, values) },
                  { key: 'max', label: t.rangeMax, value: aggregate('max', values, values) }
              ]
    )
</script>

{#if range && range.ranges.length > 0}
    <div
        data-dg-range-status
        class={slots.rangeStatusBar({ class: [theme('rangeStatusBar'), className] })}
    >
        <span>
            {t.rangeCells(range.cellCount.toLocaleString())}{#if shape}
                &nbsp;({t.rangeShape(shape.rows, shape.cols)}){/if}
        </span>
        {#if stats}
            {#each stats as stat (stat.key)}
                <span>
                    {stat.label}
                    <strong
                        class={slots.rangeStatusBarValue({ class: theme('rangeStatusBarValue') })}
                    >
                        {format(stat.value as number)}
                    </strong>
                </span>
            {/each}
        {/if}
    </div>
{/if}
