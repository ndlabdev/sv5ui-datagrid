<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { ShareTooLongError } from '../../core/grid/index.js'
    import { Button, DropdownMenu, Input, useClipboard } from 'sv5ui'

    import { getSavedViews } from '../../features/saved-views/saved-views.svelte.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import type { GridState } from '$lib/index.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const slots = datagridVariants()

    let { grid: gridProp, class: className }: { grid?: GridState<TRow>; class?: string } = $props()

    const grid = untrack(() => gridProp) ?? getGridContext<TRow>()
    const theme = getGridTheme(grid)

    const views = $derived(getSavedViews(grid))
    const t = $derived(grid.labels)

    let name = $state('')

    const clipboard = useClipboard()
    let problem = $state('')

    const items = $derived(
        (views?.views ?? []).map((view) => ({
            label: view.name,
            onSelect: () => views?.apply(view.id)
        }))
    )

    function save() {
        if (!views?.save(name)) return
        name = ''
        problem = ''
    }

    async function share() {
        if (!views) return
        try {
            const link = await views.shareLink()
            if (!link) return
            await clipboard.copy(link)
            problem = ''
        } catch (error) {
            problem =
                error instanceof ShareTooLongError
                    ? t.viewShareTooLong(error.length)
                    : String(error)
        }
    }
</script>

{#if views}
    <div data-dg-saved-views class={slots.savedViews({ class: [theme('savedViews'), className] })}>
        <span class={slots.savedViewsLabel({ class: theme('savedViewsLabel') })}
            >{t.viewsLabel}</span
        >

        {#if items.length > 0}
            <DropdownMenu {items}>
                {#snippet children({ props })}
                    <Button
                        {...props}
                        variant="outline"
                        size="xs"
                        icon="lucide:layout-list"
                        label={views.active?.name ?? t.viewsPick}
                    />
                {/snippet}
            </DropdownMenu>
        {:else}
            <span class={slots.savedViewsLabel({ class: theme('savedViewsLabel') })}
                >{t.viewsEmpty}</span
            >
        {/if}

        {#if views.modified}
            <span
                class={slots.savedViewsModified({ class: theme('savedViewsModified') })}
                aria-live="polite"
            >
                {t.viewModified}
            </span>
            <Button
                variant="outline"
                size="xs"
                label={t.viewUpdate}
                onclick={() => views.update(views.activeId!)}
            />
            <Button variant="ghost" size="xs" label={t.viewRevert} onclick={views.revert} />
        {/if}

        {#if views.active}
            <Button
                variant="ghost"
                size="xs"
                icon="lucide:trash-2"
                aria-label={t.viewRemove}
                onclick={() => views.remove(views.activeId!)}
            />
        {/if}

        <div class="grow"></div>

        <Input
            bind:value={name}
            size="sm"
            placeholder={t.viewNamePlaceholder}
            aria-label={t.viewNamePlaceholder}
            onkeydown={(event: KeyboardEvent) => event.key === 'Enter' && save()}
        />
        <Button
            variant="outline"
            size="xs"
            icon="lucide:bookmark-plus"
            label={t.viewSave}
            disabled={name.trim() === ''}
            onclick={save}
        />
        <Button
            variant="ghost"
            size="xs"
            icon="lucide:link"
            label={t.viewShare}
            onclick={() => void share()}
        />

        {#if problem || clipboard.copied}
            <span
                class={slots.savedViewsLabel({ class: theme('savedViewsLabel') })}
                aria-live="polite">{problem || t.viewShareCopied}</span
            >
        {/if}
    </div>
{/if}
