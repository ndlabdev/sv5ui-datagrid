import { describe, expect, it } from 'vitest'
import { datagridVariants } from './datagrid.variants.js'

const slots = datagridVariants()

describe('headerControls - reachable without a pointer that hovers', () => {
    it('keeps the hover reveal for pointer devices', () => {
        const controls = slots.headerControls()
        expect(controls).toContain('opacity-0')
        expect(controls).toContain('group-hover/head:opacity-100')
        expect(controls).toContain('group-focus-within/head:opacity-100')
    })

    it('stays visible where hovering is impossible', () => {
        expect(slots.headerControls()).toContain('[@media(hover:none)]:opacity-100')
    })

    it('floats over the header instead of taking width from the label', () => {
        const controls = slots.headerControls()
        expect(controls).toContain('absolute')
        expect(controls).toContain('bg-surface-container')
        expect(controls).toContain('end-1.5')
    })
})
