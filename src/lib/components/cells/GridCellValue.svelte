<script lang="ts" generics="TRow">
    import { Badge, Button, DropdownMenu, Icon, Link, Progress, Rating, User } from 'sv5ui'
    import {
        clampToMax,
        DEFAULT_EMPTY_TEXT,
        formatCellText,
        isBlank
    } from '../../core/utils/format.js'
    import type { ColumnDef, RowAction } from '../../core/types/index.js'
    import { safeHref } from '../../core/utils/url.js'
    import { defaultLabels } from '../../core/interaction/labels.js'
    import { getGridOrNull } from '../internal/context.js'

    let {
        def,
        row,
        value
    }: {
        def: ColumnDef<TRow>
        row: TRow
        value: unknown
    } = $props()

    const grid = getGridOrNull()
    const labels = $derived(grid?.labels ?? defaultLabels)

    /** Inherits the grid's language unless `typeOptions.locale` says otherwise. */
    const options = $derived({ locale: grid?.locale, ...def.typeOptions })
    const emptyText = $derived(options.emptyText ?? DEFAULT_EMPTY_TEXT)
    const blank = $derived(isBlank(value))

    // The same function a `cell` snippet reads through `formatted`, so the two
    // cannot drift. Blank is handled there; this branch only runs when not.
    const text = $derived(formatCellText(value, def, grid?.locale) ?? String(value ?? ''))

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
                    label={labels.rowActions}
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
    {@const href = safeHref(options.href?.(row) ?? value)}
    {#if href}
        <Link
            {href}
            target={options.target}
            external={options.target === '_blank'}
            tabindex={-1}
            class="truncate"
            data-dg-truncate>{text}</Link
        >
    {:else}
        <span class="truncate" data-dg-truncate>{text}</span>
    {/if}
{:else}
    <span class="truncate" data-dg-truncate>{text}</span>
{/if}
