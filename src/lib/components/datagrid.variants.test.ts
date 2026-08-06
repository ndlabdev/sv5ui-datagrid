import { describe, expect, it } from 'vitest'
import { datagridVariants } from './datagrid.variants.js'

const slots = datagridVariants()

describe('headerControls — reachable without a pointer that hovers', () => {
    it('keeps the hover reveal for pointer devices', () => {
        const controls = slots.headerControls()
        expect(controls).toContain('opacity-0')
        expect(controls).toContain('group-hover/head:opacity-100')
        // Keyboard users never hover, so focus has to reveal them too.
        expect(controls).toContain('group-focus-within/head:opacity-100')
    })

    it('stays visible where hovering is impossible', () => {
        // Without this the filter and column-menu triggers are invisible on a
        // touch device — and still tappable, so they swallow taps meant for the
        // header. Tailwind emits arbitrary media variants last, which is what
        // lets this outrank the base `opacity-0`.
        expect(slots.headerControls()).toContain('[@media(hover:none)]:opacity-100')
    })

    it('floats over the header instead of taking width from the label', () => {
        // In flow the triggers reserved their width even while invisible, and a
        // narrow column had nothing left to render its header text in.
        const controls = slots.headerControls()
        expect(controls).toContain('absolute')
        // Opaque, so the label underneath does not show through them.
        expect(controls).toContain('bg-surface-container')
        // Stops short of the resize handle, which sits at the very edge.
        expect(controls).toContain('end-1.5')
    })
})
