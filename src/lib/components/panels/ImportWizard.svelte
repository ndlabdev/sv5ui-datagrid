<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { Alert, Button, Checkbox, FileUpload, Select } from 'sv5ui'
    import { getDataImport } from '../../features/data-import/data-import.svelte.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import type { GridState } from '$lib/index.js'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'

    const slots = datagridVariants()

    let {
        grid: gridProp,
        class: className
    }: {
        grid?: GridState<TRow>
        class?: string
    } = $props()

    const grid = untrack(() => gridProp) ?? getGridContext<TRow>()
    const theme = getGridTheme(grid)

    const t = $derived(grid.labels)
    const importing = $derived(getDataImport(grid))
    const fieldId = $props.id()

    const extensions = $derived(
        (importing?.accepts ?? [])
            .filter((format) => format !== 'clipboard')
            .map((format) => `.${format}`)
    )

    const columnLabel = (columnId: string): string => {
        const column = grid.columns.get(columnId)
        return String(column?.def.header ?? columnId)
    }

    const sourceItems = $derived([
        { label: t.importSkipColumn, value: '' },
        ...(importing?.headers ?? []).map((header, index) => ({
            label: header,
            value: String(index)
        }))
    ])

    const sheetItems = $derived(
        (importing?.sheets ?? []).map((name) => ({ label: name, value: name }))
    )

    async function paste() {
        try {
            const text = await navigator.clipboard.readText()
            await importing?.takeText(text, 'tsv')
        } catch {
            await importing?.takeText('', 'tsv')
        }
    }
</script>

{#if importing}
    <section
        data-dg-import={importing.step}
        class={slots.importPanel({ class: [theme('importPanel'), className] })}
        aria-label={t.importTitle}
    >
        {#if importing.step === 'idle'}
            <FileUpload
                accept={extensions.join(',')}
                label={t.importDropHere}
                description={extensions.join(' | ')}
                onValueChange={(files: File[]) => {
                    if (files[0]) void importing.take(files[0])
                }}
            />

            {#if importing.accepts.includes('clipboard')}
                <div class="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        icon="lucide:clipboard"
                        label={t.importPaste}
                        onclick={paste}
                    />
                </div>
            {/if}
        {:else if importing.step === 'mapping'}
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-medium text-on-surface">{t.importMatchTitle}</h3>
                <span class={slots.importHint({ class: theme('importHint') })}>
                    {#if importing.fileName}{importing.fileName} |
                    {/if}{t.importRowCount(importing.sourceCount)}
                </span>
            </div>

            <div class="flex flex-wrap items-center gap-4">
                <Checkbox
                    label={t.importHeaderRow}
                    checked={importing.hasHeader}
                    onCheckedChange={(next: boolean) => importing.setHasHeader(next)}
                />
                {#if importing.sheets.length > 1}
                    <label class="sr-only" for={`${fieldId}-sheet`}>{t.importSheet}</label>
                    <Select
                        id={`${fieldId}-sheet`}
                        items={sheetItems}
                        class="w-48"
                        aria-label={t.importSheet}
                        bind:value={
                            () => importing.sheet ?? '',
                            (next) => void importing.setSheet(next as string)
                        }
                    />
                {/if}
            </div>

            <div class="overflow-x-auto rounded-md border border-outline-variant">
                <table class="w-full text-left text-xs">
                    <thead class="bg-surface-container text-on-surface-variant">
                        <tr>
                            {#each importing.headers as header, index (index)}
                                <th class="truncate px-2 py-1 font-medium">{header}</th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each importing.preview as line, row (row)}
                            <tr class="border-t border-outline-variant/60">
                                {#each importing.headers as _header, index (index)}
                                    <td class="truncate px-2 py-1 text-on-surface-variant">
                                        {line[index] ?? ''}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <p
                class={slots.importHint({
                    class: [
                        theme('importHint'),
                        importing.matchedCount === 0 ? 'text-error' : undefined
                    ]
                })}
                aria-live="polite"
            >
                {importing.matchedCount === 0
                    ? t.importNothingMatched
                    : t.importMatched(importing.matchedCount, importing.mappings.length)}
            </p>

            <div class="grid gap-1 lg:grid-cols-2">
                {#each importing.mappings as mapping (mapping.columnId)}
                    <div class={slots.importMapRow({ class: theme('importMapRow') })}>
                        <span class={slots.importMapLabel({ class: theme('importMapLabel') })}>
                            {columnLabel(mapping.columnId)}
                        </span>
                        <label class="sr-only" for={`${fieldId}-${mapping.columnId}`}>
                            {t.importColumnFrom}
                        </label>
                        <Select
                            id={`${fieldId}-${mapping.columnId}`}
                            items={sourceItems}
                            class={slots.importMapSelect({ class: theme('importMapSelect') })}
                            placeholder={t.importSkipColumn}
                            aria-label={t.importColumnFrom}
                            bind:value={
                                () =>
                                    mapping.sourceIndex === null ? '' : String(mapping.sourceIndex),
                                (next) =>
                                    importing.setMapping(
                                        mapping.columnId,
                                        next === '' ? null : Number(next)
                                    )
                            }
                        />
                    </div>
                {/each}
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    label={t.importNext}
                    loading={importing.busy}
                    disabled={!importing.canReview}
                    onclick={() => void importing.review()}
                />
                <Button
                    variant="ghost"
                    color="surface"
                    size="sm"
                    label={t.importCancel}
                    onclick={importing.cancel}
                />
            </div>
        {:else}
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-medium text-on-surface">{t.importReviewTitle}</h3>
                <span class={slots.importHint({ class: theme('importHint') })} aria-live="polite">
                    {importing.problems.length === 0
                        ? t.importReady
                        : t.importIssues(importing.badRows.size)}
                </span>
            </div>

            {#if importing.issueCounts.length > 0}
                <div class={slots.importIssueList({ class: theme('importIssueList') })}>
                    {#each importing.issueCounts as issue (issue.message)}
                        <div class={slots.importIssueRow({ class: theme('importIssueRow') })}>
                            <span class="truncate">{issue.message}</span>
                            <span
                                class={slots.importIssueCount({ class: theme('importIssueCount') })}
                                >{issue.count}</span
                            >
                        </div>
                    {/each}
                </div>
            {/if}

            <div class="flex flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    label={t.importAddRows(importing.staged.length)}
                    loading={importing.busy}
                    disabled={importing.staged.length === 0}
                    onclick={() => void importing.commit()}
                />
                {#if importing.badRows.size > 0}
                    <Button
                        variant="outline"
                        size="sm"
                        label={t.importAddValid(importing.validCount)}
                        disabled={importing.validCount === 0}
                        onclick={() => void importing.commit({ validOnly: true })}
                    />
                {/if}
                <Button
                    variant="ghost"
                    color="surface"
                    size="sm"
                    label={t.importBack}
                    onclick={importing.back}
                />
                <Button
                    variant="ghost"
                    color="surface"
                    size="sm"
                    label={t.importCancel}
                    onclick={importing.cancel}
                />
            </div>
        {/if}

        {#if importing.error}
            <Alert color="error" description={importing.error} />
        {/if}
    </section>
{/if}
