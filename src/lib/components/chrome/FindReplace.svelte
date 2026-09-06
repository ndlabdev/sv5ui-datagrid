<script lang="ts">
    import { Button, Checkbox, Input, useKbd } from 'sv5ui'

    import { getFindReplace } from '../../features/find-replace/find-replace.svelte.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const grid = getGridContext()
    const theme = getGridTheme()
    const slots = datagridVariants()

    let { class: className }: { class?: string } = $props()

    const find = $derived(getFindReplace(grid))
    const t = $derived(grid.labels)

    let input = $state<HTMLInputElement | null>(null)
    let replaceInput = $state<HTMLInputElement | null>(null)
    let wanted = $state<'find' | 'replace'>('find')

    $effect(() => {
        if (!find?.open) return
        if (wanted === 'replace' && replaceInput) replaceInput.focus()
        else input?.focus()
    })

    function openAt(field: 'find' | 'replace') {
        wanted = field
        find?.show()

        if (field === 'replace') replaceInput?.focus()
        else input?.focus()
    }

    const shortcuts = $derived({
        'ctrl+f': () => openAt('find'),
        'meta+f': () => openAt('find'),
        ...(find?.replace
            ? { 'ctrl+h': () => openAt('replace'), 'meta+h': () => openAt('replace') }
            : {})
    })

    useKbd({
        shortcuts: () => shortcuts,
        enabled: () => find?.hotkeys ?? false
    })

    function onKeydown(event: KeyboardEvent) {
        if (!find) return
        if (event.key === 'Enter') {
            event.preventDefault()
            find.step(event.shiftKey ? -1 : 1)
            return
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            find.hide()
        }
    }
</script>

{#if find?.open}
    <div
        data-dg-find
        role="search"
        aria-label={t.findTitle}
        class={slots.findPanel({ class: [theme('findPanel'), className] })}
    >
        <Input
            bind:ref={input}
            bind:value={find.query}
            size="sm"
            icon="lucide:search"
            placeholder={t.findPlaceholder}
            aria-label={t.findPlaceholder}
            oninput={() => (find.replaced = null)}
            onkeydown={onKeydown}
        />

        <span class={slots.findCount({ class: theme('findCount') })} aria-live="polite">
            {#if find.replaced !== null}
                {t.findReplaced(find.replaced)}
            {:else if find.query === ''}
                &nbsp;
            {:else if find.total === 0}
                {find.partial ? t.findNoMatchLoaded : t.findNoMatch}
            {:else if find.replace && !find.replaceAvailable}
                {t.findServerReadOnly}
            {:else if find.replace && find.writableTotal === 0}
                {t.findNoWritable(find.total)}
            {:else if find.partial}
                {t.findCountLoaded(find.current + 1, find.total)}
            {:else}
                {t.findCount(find.current + 1, find.total)}
            {/if}
        </span>

        <Button
            variant="ghost"
            size="xs"
            icon="lucide:chevron-up"
            aria-label={t.findPrevious}
            disabled={find.total === 0}
            onclick={() => find.step(-1)}
        />
        <Button
            variant="ghost"
            size="xs"
            icon="lucide:chevron-down"
            aria-label={t.findNext}
            disabled={find.total === 0}
            onclick={() => find.step(1)}
        />

        <Checkbox bind:checked={find.caseSensitive} size="sm" label={t.findCaseSensitive} />
        <Checkbox bind:checked={find.wholeCell} size="sm" label={t.findWholeCell} />

        {#if find.replaceAvailable}
            <Input
                bind:ref={replaceInput}
                bind:value={find.replacement}
                size="sm"
                icon="lucide:replace"
                placeholder={t.replacePlaceholder}
                aria-label={t.replacePlaceholder}
                onkeydown={onKeydown}
            />
            <Button
                variant="outline"
                size="xs"
                label={t.findReplaceOne}
                disabled={!find.canReplaceCurrent}
                onclick={() => void find.replaceCurrent()}
            />
            <Button
                variant="outline"
                size="xs"
                label={t.findReplaceAll}
                disabled={!find.canReplaceAll}
                onclick={() => void find.replaceAll()}
            />
        {/if}

        <div class="grow"></div>

        <Button
            variant="ghost"
            size="xs"
            icon="lucide:x"
            aria-label={t.findClose}
            onclick={find.hide}
        />
    </div>
{/if}
