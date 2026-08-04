<script lang="ts" generics="TRow">
    import {
        Checkbox,
        DatePicker,
        Input,
        InputNumber,
        InputTags,
        Rating,
        Select,
        SelectMenu,
        Textarea,
        TimeField,
        useClickOutside
    } from 'sv5ui'
    import type { ColumnState, EditorContext, RowNode } from '../../core/types/index.js'
    import { editorTypeOf, getEditing } from '../../features/editing/index.js'
    import { getGridContext } from '../internal/context.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { isInPortal } from '../internal/portal.js'
    import { getGridTheme } from '../internal/theme.js'
    import {
        fromDateValue,
        fromTimeValue,
        toDateValue,
        toTimeValue
    } from '../internal/editor-values.js'

    let {
        node,
        column,
        rowMode = false
    }: { node: RowNode<TRow>; column: ColumnState<TRow>; rowMode?: boolean } = $props()

    const grid = getGridContext<TRow>()
    const editing = getEditing(grid)!
    const slots = datagridVariants()
    const theme = getGridTheme()

    const type = $derived(editorTypeOf(column))
    const editorDef = $derived(
        typeof column.def.editor === 'object' ? column.def.editor : undefined
    )
    const value = $derived(rowMode ? editing.drafts[column.id] : editing.draft)
    const error = $derived(rowMode ? (editing.rowErrors[column.id] ?? null) : editing.error)
    const text = $derived(value === null || value === undefined ? '' : String(value))
    const numberValue = $derived.by((): number | null => {
        if (typeof value === 'number') return value
        if (value === null || value === undefined || value === '') return null
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
    })

    // Commit on leaving, not per change: date/time are typed segment by
    // segment and would close the editor mid-entry.
    const inputBased = $derived(
        type === 'text' ||
            type === 'number' ||
            type === 'textarea' ||
            type === 'tags' ||
            type === 'time' ||
            type === 'date'
    )
    // Where Enter commits rather than belonging to the widget.
    const enterCommits = $derived(
        type === 'text' || type === 'number' || type === 'time' || type === 'date'
    )
    // Focus the first segment so the user can type instead of picking.
    const segmented = $derived(type === 'date' || type === 'time')

    const flatText = $derived(
        type === 'text' || type === 'number' || type === 'textarea' || type === 'tags'
    )
    const containerClass = $derived(
        `${slots.cellEditor({ class: theme('cellEditor') })} ${flatText ? slots.cellEditorFlat({ class: theme('cellEditorFlat') }) : slots.cellEditorPad({ class: theme('cellEditorPad') })}`
    )
    const fieldClass = $derived(slots.cellEditorField({ class: theme('cellEditorField') }))
    const fieldUi = { base: 'h-full min-h-(--dg-row-h) rounded-none border-0 bg-transparent px-3' }
    // No stepper buttons: their focus churn glitched the edit.
    const numberUi = { ...fieldUi, increment: 'hidden', decrement: 'hidden', base: 'ps-0 pe-0' }

    function setValue(next: unknown) {
        if (rowMode) editing.setRowDraft(column.id, next)
        else editing.setDraft(next)
    }

    function commit() {
        if (rowMode) void editing.commitRow()
        else void editing.commit()
    }

    function cancel() {
        if (rowMode) editing.cancelRow()
        else editing.cancel()
    }

    function setAndCommit(next: unknown) {
        setValue(next)
        if (!rowMode) commit()
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.stopPropagation()
            cancel()
        } else if (event.key === 'Enter' && enterCommits) {
            event.preventDefault()
            event.stopPropagation()
            if (rowMode) commit()
            else editing.commitAndMove('down')
        } else if (event.key === 'Tab' && inputBased && !rowMode) {
            event.preventDefault()
            event.stopPropagation()
            editing.commitAndMove(event.shiftKey ? 'left' : 'right')
        }
    }

    // Outside-click rather than blur: a widget's inner control blurs the
    // input to <body>. A portalled popup the editor opened is not outside.
    function onClickOutside(event: PointerEvent) {
        if (!inputBased || rowMode || !editing.commitOnBlur || !editing.active) return
        if (isInPortal(event.target)) return
        void editing.commit()
    }

    let container = $state<HTMLElement | null>(null)
    let inputRef = $state<HTMLInputElement | null>(null)
    let textareaRef = $state<HTMLTextAreaElement | null>(null)

    function focusSegment() {
        container?.querySelector<HTMLElement>('[role="spinbutton"]')?.focus()
    }

    // The calendar hands focus back to the cell, where Enter would never
    // reach the editor. Only then — moving it while typing restarts entry.
    function setDate(next: { year: number; month: number; day: number } | undefined) {
        setValue(fromDateValue(next))
        requestAnimationFrame(() => {
            if (container && !container.contains(document.activeElement)) focusSegment()
        })
    }

    $effect(() => {
        if (segmented) {
            focusSegment()
            return
        }
        const field = inputRef ?? textareaRef
        if (!field) return
        field.focus()
        if (type === 'text' || type === 'number') field.select()
    })

    const selectItems = $derived(editorDef?.options ?? [])

    const editorContext: EditorContext<TRow> = $derived({
        value,
        row: node.row,
        node,
        setValue,
        commit,
        cancel,
        error
    })
</script>

<div
    bind:this={container}
    class={containerClass}
    data-dg-editing
    role="presentation"
    onkeydowncapture={onKeydown}
    use:useClickOutside={{ handler: onClickOutside }}
>
    {#if editorDef?.editor}
        {@render editorDef.editor(editorContext)}
    {:else if type === 'checkbox'}
        <Checkbox
            checked={Boolean(value)}
            onCheckedChange={setAndCommit}
            label={column.header}
            ui={{ label: 'sr-only', wrapper: 'ms-0 me-0' }}
        />
    {:else if type === 'number'}
        <InputNumber
            bind:ref={inputRef}
            variant="none"
            class={fieldClass}
            ui={numberUi}
            bind:value={() => numberValue, (next) => setValue(next)}
            aria-label={column.header}
            aria-invalid={error ? true : undefined}
        />
    {:else if type === 'select'}
        <Select
            items={selectItems}
            bind:value={() => text, (next) => setAndCommit(next as string)}
            aria-label={column.header}
        />
    {:else if type === 'selectMenu'}
        <SelectMenu
            items={selectItems}
            bind:value={() => text, (next) => setAndCommit(next as string)}
            aria-label={column.header}
        />
    {:else if type === 'date'}
        <DatePicker value={toDateValue(value)} onValueChange={setDate} name={column.id} />
    {:else if type === 'time'}
        <TimeField
            value={toTimeValue(value)}
            onValueChange={(next) => setValue(fromTimeValue(next))}
        />
    {:else if type === 'rating'}
        <Rating
            value={typeof value === 'number' ? value : Number(value) || 0}
            onValueChange={setAndCommit}
            aria-label={column.header}
        />
    {:else if type === 'tags'}
        <InputTags
            bind:ref={inputRef}
            variant="none"
            class={fieldClass}
            bind:value={() => (Array.isArray(value) ? value : []), (next) => setValue(next)}
            aria-label={column.header}
            aria-invalid={error ? true : undefined}
        />
    {:else if type === 'textarea'}
        <Textarea
            bind:ref={textareaRef}
            variant="none"
            class={fieldClass}
            ui={fieldUi}
            value={text}
            oninput={(event) => setValue((event.currentTarget as HTMLTextAreaElement).value)}
            aria-label={column.header}
            aria-invalid={error ? true : undefined}
        />
    {:else}
        <Input
            bind:ref={inputRef}
            variant="none"
            class={fieldClass}
            ui={fieldUi}
            value={text}
            oninput={(event) => setValue((event.currentTarget as HTMLInputElement).value)}
            aria-label={column.header}
            aria-invalid={error ? true : undefined}
        />
    {/if}

    {#if error}
        <span role="alert" class={slots.cellError({ class: theme('cellError') })}>{error}</span>
    {/if}
</div>
