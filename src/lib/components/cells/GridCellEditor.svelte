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
    /**
     * Opening the editor is the choice; the list is what the user came for, so
     * it is already down rather than waiting for a second key.
     */
    const listEditor = $derived(type === 'select' || type === 'selectMenu')
    let listOpen = $state(false)
    $effect(() => {
        if (listEditor) listOpen = true
    })

    const flatText = $derived(
        type === 'text' || type === 'number' || type === 'textarea' || type === 'tags'
    )
    const containerClass = $derived(
        [
            slots.cellEditor({ class: theme('cellEditor') }),
            flatText
                ? slots.cellEditorFlat({ class: theme('cellEditorFlat') })
                : slots.cellEditorPad({ class: theme('cellEditorPad') }),
            segmented ? slots.cellEditorWide({ class: theme('cellEditorWide') }) : ''
        ]
            .filter(Boolean)
            .join(' ')
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

    /**
     * What a key means inside an editor, or null to leave it to the widget.
     * `Ctrl`/`Cmd`+`Enter` is the way out of one that owns Enter for itself —
     * a textarea takes a newline, tags take a tag. `Tab` commits too, but only
     * by leaving; this one stays on the cell.
     */
    function enterAction(event: KeyboardEvent): (() => void) | null {
        if (event.ctrlKey || event.metaKey) return commit
        if (!enterCommits) return null
        return rowMode ? commit : () => editing.commitAndMove('down')
    }

    function editorAction(event: KeyboardEvent): (() => void) | null {
        if (event.key === 'Escape') return cancel
        if (event.key === 'Enter') return enterAction(event)
        if (event.key === 'Tab' && inputBased && !rowMode) {
            return () => editing.commitAndMove(event.shiftKey ? 'left' : 'right')
        }
        return null
    }

    function onKeydown(event: KeyboardEvent) {
        const action = editorAction(event)
        if (!action) return
        // Escape keeps the browser's own default: it is the widget's cue to
        // close whatever it opened.
        if (event.key !== 'Escape') event.preventDefault()
        event.stopPropagation()
        action()
    }

    // Outside-click rather than blur: a widget's inner control blurs the
    // input to <body>. A portalled popup the editor opened is not outside.
    function onClickOutside(event: PointerEvent) {
        if (rowMode || !editing.active || isInPortal(event.target)) return
        // A widget commits as its value changes, so nothing is left pending
        // and leaving simply ends the edit. Without this the editor stayed
        // open with no way out but picking a value.
        if (!inputBased) cancel()
        else if (editing.commitOnBlur) void editing.commit()
    }

    let container = $state<HTMLElement | null>(null)
    let inputRef = $state<HTMLInputElement | null>(null)
    let textareaRef = $state<HTMLTextAreaElement | null>(null)

    function focusSegment() {
        container?.querySelector<HTMLElement>('[role="spinbutton"]')?.focus()
    }

    /**
     * A widget renders its own control, so the caret has to be handed over:
     * left on the cell, the arrows never reach the list that just opened and
     * Space never reaches the checkbox.
     */
    function focusWidget() {
        container
            ?.querySelector<HTMLElement>(
                '[data-combobox-trigger],[data-select-trigger],button,[role="checkbox"],[role="radio"],[tabindex="0"]'
            )
            ?.focus()
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
        if (!field) {
            focusWidget()
            return
        }
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
            bind:open={listOpen}
            bind:value={() => text, (next) => setAndCommit(next as string)}
            aria-label={column.header}
        />
    {:else if type === 'selectMenu'}
        <SelectMenu
            items={selectItems}
            bind:open={listOpen}
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
