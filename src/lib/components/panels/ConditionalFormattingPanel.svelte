<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { type ColumnState, SELECTION_COLUMN_ID } from '../../core/types/index.js'
    import { Button, Input, Select } from 'sv5ui'

    import { getConditionalFormatting } from '../../features/conditional-formatting/conditional-formatting.svelte.js'
    import type { FormatRule } from '../../features/conditional-formatting/conditional-formatting.types.js'
    import { ruleId } from '../../features/conditional-formatting/rules.js'
    import {
        hasNumbers,
        NUMERIC_KINDS,
        sampleDataRows
    } from '../../features/conditional-formatting/stats.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import type { GridState } from '$lib/index.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const theme = getGridTheme()
    const slots = datagridVariants()

    let { grid: gridProp, class: className }: { grid?: GridState<TRow>; class?: string } = $props()

    const grid = untrack(() => gridProp) ?? getGridContext<TRow>()

    const SAMPLE_ROWS = 50

    const formatting = $derived(getConditionalFormatting(grid))
    const t = $derived(grid.labels)

    type Kind = FormatRule['kind']

    let kind = $state<Kind>('colorScale')
    let picked = $state<string | null>(null)
    let topCount = $state('10')
    let expression = $state('')

    function kindLabel(of: Kind): string {
        return {
            colorScale: t.formatKindColorScale,
            dataBar: t.formatKindDataBar,
            duplicates: t.formatKindDuplicates,
            topN: t.formatKindTopN,
            expression: t.formatKindExpression
        }[of]
    }

    const kindItems = $derived(
        (['colorScale', 'dataBar', 'duplicates', 'topN', 'expression'] as Kind[]).map((of) => ({
            value: of,
            label: kindLabel(of)
        }))
    )

    const needsColumn = $derived(kind !== 'expression')
    const needsNumbers = $derived(NUMERIC_KINDS.includes(kind))

    const sample = $derived(sampleDataRows(grid.preWindowNodes, SAMPLE_ROWS))

    function readable(column: ColumnState<TRow>): boolean {
        return !needsNumbers || sample.length === 0 || hasNumbers(sample, column)
    }

    const dataColumns = $derived(
        grid.columns.visible
            .filter((column) => column.id !== SELECTION_COLUMN_ID)
            .filter(readable)
            .map((column) => ({ value: column.id, label: column.header }))
    )

    const columnItems = $derived(
        needsColumn ? dataColumns : [{ value: '', label: t.formatWholeRow }, ...dataColumns]
    )

    const columnId = $derived(
        needsColumn ? picked || (dataColumns[0]?.value ?? '') : (picked ?? '')
    )

    function headerOf(id: string | undefined): string {
        return id ? (grid.columns.get(id)?.header ?? id) : t.formatWholeRow
    }

    const chips = $derived(
        (formatting?.rules ?? []).map((rule, index) => {
            const id = ruleId(rule, index)
            return {
                id,
                name: t.formatRuleName(kindLabel(rule.kind), headerOf(rule.column)),
                error: formatting?.errorOf(id) ?? null
            }
        })
    )

    const invalid = $derived(chips.find((chip) => chip.error)?.error ?? null)
    const invalidChip = $derived(
        slots.formatRuleChipInvalid({ class: theme('formatRuleChipInvalid') })
    )

    const canAdd = $derived(needsColumn ? columnId !== '' : expression.trim() !== '')

    function built(): FormatRule | null {
        if (kind === 'expression') {
            return { kind, when: expression.trim(), column: columnId || undefined }
        }
        if (!columnId) return null
        if (kind === 'topN') {
            const count = Number(topCount)
            return { kind, column: columnId, n: Number.isFinite(count) ? count : undefined }
        }
        return { kind, column: columnId }
    }

    function add() {
        const rule = built()
        if (!rule) return

        grid.api.addFormatRule?.(rule)
        expression = ''
    }
</script>

{#if formatting}
    <div
        data-dg-format-panel
        class={slots.formatPanel({ class: [theme('formatPanel'), className] })}
    >
        <span class={slots.formatPanelLabel({ class: theme('formatPanelLabel') })}
            >{t.formatLabel}</span
        >

        {#each chips as chip (chip.id)}
            <span
                class={slots.formatRuleChip({
                    class: [theme('formatRuleChip'), chip.error ? invalidChip : undefined]
                })}
            >
                <span class={slots.formatRuleChipLabel({ class: theme('formatRuleChipLabel') })}
                    >{chip.name}</span
                >
                <Button
                    variant="ghost"
                    size="xs"
                    icon="lucide:x"
                    aria-label={t.formatRemoveRule(chip.name)}
                    onclick={() => grid.api.removeFormatRule?.(chip.id)}
                />
            </span>
        {/each}

        {#if chips.length === 0}
            <span class={slots.formatPanelEmpty({ class: theme('formatPanelEmpty') })}
                >{t.formatEmpty}</span
            >
        {/if}

        <div class="grow"></div>

        <Select
            items={kindItems}
            bind:value={() => kind, (next) => (kind = next as Kind)}
            size="xs"
            aria-label={t.formatKind}
            class="w-40"
        />

        <Select
            items={columnItems}
            bind:value={() => columnId, (next) => (picked = String(next))}
            size="xs"
            aria-label={t.formatColumn}
            class="w-40"
        />

        {#if kind === 'topN'}
            <Input
                bind:value={topCount}
                type="number"
                size="xs"
                aria-label={t.formatTopCount}
                class="w-20"
            />
        {/if}

        {#if kind === 'expression'}
            <Input
                bind:value={expression}
                size="xs"
                placeholder={t.formatExpressionPlaceholder}
                aria-label={t.formatKindExpression}
                class="w-56 font-mono"
            />
        {/if}

        <Button
            variant="outline"
            size="xs"
            icon="lucide:plus"
            label={t.formatAdd}
            disabled={!canAdd}
            onclick={add}
        />

        {#if chips.length > 0}
            <Button
                variant="ghost"
                size="xs"
                label={t.formatClear}
                onclick={() => grid.api.clearFormatRules?.()}
            />
        {/if}

        {#if invalid}
            <span
                class={slots.formatPanelError({ class: theme('formatPanelError') })}
                aria-live="polite"
            >
                {t.formatBadExpression(invalid.message)}
            </span>
        {/if}
    </div>
{/if}
