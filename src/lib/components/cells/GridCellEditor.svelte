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

    // Editors typed into a field: they commit when the user leaves the editor,
    // not on every internal change — date/time are typed segment by segment,
    // so committing per change would close the editor mid-entry.
    const inputBased = $derived(
        type === 'text' ||
            type === 'number' ||
            type === 'textarea' ||
            type === 'tags' ||
            type === 'time' ||
            type === 'date'
    )
    // Editors where Enter should commit rather than be handled by the widget
    // (a textarea inserts a newline, InputTags adds a tag, popups own Enter).
    const enterCommits = $derived(
        type === 'text' || type === 'number' || type === 'time' || type === 'date'
    )
    // Date and time are typed into segments; focus the first one on open so
    // the user can type immediately instead of having to pick from a popup.
    const segmented = $derived(type === 'date' || type === 'time')

    // Text-field editors fill the cell edge-to-edge with a single crisp
    // rectangular ring; widgets keep their own trigger chrome inside a
    // lightly padded box.
    const flatText = $derived(
        type === 'text' || type === 'number' || type === 'textarea' || type === 'tags'
    )
    const containerClass = $derived(
        `${slots.cellEditor()} ${flatText ? slots.cellEditorFlat() : slots.cellEditorPad()}`
    )
    const fieldClass = slots.cellEditorField()
    const fieldUi = { base: 'h-full min-h-(--dg-row-h) rounded-none border-0 bg-transparent px-3' }
    // Number editor keeps InputNumber's formatting + arrow keys but drops the
    // stepper buttons (their focus/controlled-state churn caused edit glitches).
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

    // Widgets (select, date, checkbox, rating) that commit as soon as their
    // value changes rather than on blur/Enter.
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

    // Commit on a genuine click outside the editor. Blur is unreliable for
    // widgets with inner controls (a number stepper doesn't take focus, so
    // the input blurs to <body>); an outside-click test ignores them.
    // A popup the editor itself opened (calendar, listbox) is portaled to the
    // body, so it reads as "outside" — treat it as part of the editor,
    // otherwise picking a date would commit the pre-pick draft.
    function onClickOutside(event: PointerEvent) {
        if (!inputBased || rowMode || !editing.commitOnBlur || !editing.active) return
        const target = event.target as HTMLElement | null
        if (target?.closest?.('[data-bits-floating-content-wrapper]')) return
        void editing.commit()
    }

    let container = $state<HTMLElement | null>(null)
    let inputRef = $state<HTMLInputElement | null>(null)
    let textareaRef = $state<HTMLTextAreaElement | null>(null)

    function focusSegment() {
        container?.querySelector<HTMLElement>('[role="spinbutton"]')?.focus()
    }

    // Picking from the calendar hands focus back to the grid cell, which sits
    // outside this editor — Enter would then never reach it. Pull focus back
    // only in that case; while typing, focus is already on a segment and
    // moving it would restart entry at the first one.
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
            ui={{ label: 'sr-only' }}
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
        <span role="alert" class={slots.cellError()}>{error}</span>
    {/if}
</div>
