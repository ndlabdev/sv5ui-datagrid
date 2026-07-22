import { describe, expect, it } from 'vitest'
import { datagridVariants } from './datagrid.variants.js'

const slots = datagridVariants()

describe('menuButton — reachable without a pointer that hovers', () => {
    it('keeps the hover reveal for pointer devices', () => {
        const menuButton = slots.menuButton()
        expect(menuButton).toContain('opacity-0')
        expect(menuButton).toContain('group-hover/head:opacity-100')
        // Keyboard users never hover, so focus has to reveal it too.
        expect(menuButton).toContain('group-focus-within/head:opacity-100')
    })

    it('stays visible where hovering is impossible', () => {
        // Without this the filter and column-menu triggers are invisible on a
        // touch device — and still tappable, so they swallow taps meant for the
        // header. Tailwind emits arbitrary media variants last, which is what
        // lets this outrank the base `opacity-0`.
        expect(slots.menuButton()).toContain('[@media(hover:none)]:opacity-100')
    })
})
