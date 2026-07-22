<script lang="ts" generics="TRow">
    import { Badge, Button, DropdownMenu, Icon, Link, Progress, Rating, User } from 'sv5ui'
    import {
        clampToMax,
        DEFAULT_EMPTY_TEXT,
        formatCurrency,
        formatDate,
        formatNumber,
        formatPercent,
        isBlank
    } from '../core/format.js'
    import type { ColumnDef, RowAction } from '../core/types.js'

    let {
        def,
        row,
        value
    }: {
        def: ColumnDef<TRow>
        row: TRow
        value: unknown
    } = $props()

    const options = $derived(def.typeOptions ?? {})
    const emptyText = $derived(options.emptyText ?? DEFAULT_EMPTY_TEXT)
    const blank = $derived(isBlank(value))

    const text = $derived.by(() => {
        switch (def.type) {
            case 'number':
                return formatNumber(value, options)
            case 'currency':
                return formatCurrency(value, options)
            case 'percent':
                return formatPercent(value, options)
            case 'date':
                return formatDate(value, options)
            case 'datetime':
                return formatDate(value, options, true)
            default:
                return String(value ?? '')
        }
    })

    const actions = $derived<RowAction<TRow>[]>(
        def.type === 'actions' ? (options.actions?.(row) ?? []) : []
    )

    const menuItems = $derived(
        actions.map((action) => ({
            type: 'item' as const,
            label: action.label,
            icon: action.icon,
            disabled: action.disabled,
            color: action.destructive ? ('error' as const) : undefined,
            onSelect: () => action.onSelect(row)
        }))
    )
</script>

{#if def.type === 'actions'}
    {#if actions.length > 0}
        <DropdownMenu items={menuItems}>
            {#snippet children({ props })}
                <Button
                    {...props}
                    variant="ghost"
                    size="xs"
                    square
                    tabindex={-1}
                    icon="lucide:ellipsis"
                    label="Row actions"
                    ui={{ label: 'sr-only' }}
                />
            {/snippet}
        </DropdownMenu>
    {/if}
{:else if blank}
    <span class="text-on-surface-variant">{emptyText}</span>
{:else if def.type === 'boolean'}
    <Icon
        name={value ? (options.trueIcon ?? 'lucide:check') : (options.falseIcon ?? 'lucide:minus')}
        class={value ? 'size-4 text-success' : 'size-4 text-on-surface-variant'}
        aria-label={String(Boolean(value))}
    />
{:else if def.type === 'badge'}
    <Badge
        label={String(value)}
        color={options.colors?.[String(value)] ?? options.fallbackColor ?? 'surface'}
        size="sm"
    />
{:else if def.type === 'user'}
    <User
        name={String(value)}
        description={options.description?.(row)}
        avatar={{ src: options.avatar?.(row), alt: String(value) }}
        size="sm"
    />
{:else if def.type === 'progress'}
    {@const max = options.max ?? 100}
    <Progress
        value={clampToMax(value, max)}
        {max}
        size="sm"
        class="w-full"
        aria-label={def.header ?? def.id}
    />
{:else if def.type === 'rating'}
    {@const max = options.max ?? 5}
    <Rating
        value={clampToMax(value, max)}
        {max}
        readonly
        size="sm"
        aria-label={`${value} / ${max}`}
    />
{:else if def.type === 'link'}
    <Link
        href={options.href?.(row) ?? String(value)}
        target={options.target}
        external={options.target === '_blank'}
        tabindex={-1}
        class="truncate">{text}</Link
    >
{:else}
    <span class="truncate">{text}</span>
{/if}
