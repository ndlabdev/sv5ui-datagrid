import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defineDataGridConfig, resetDataGridConfig } from '$lib/index.js'
import { slotClass } from '../lib/core/theme/index.js'

const stylesheet = readFileSync(join('src', 'lib', 'theme.css'), 'utf8')

describe('the stylesheet the fade needs', () => {
    it('declares the keyframes the mark animates through', () => {
        expect(stylesheet).toContain('@keyframes dg-flash-fade')
        expect(stylesheet).toMatch(/box-shadow:[^;]*var\(--dg-flash-tint/)
        expect(stylesheet).toMatch(/box-shadow:\s*inset[^;]*transparent/)
    })

    it('washes the cell rather than bordering it, which means selection here', () => {
        const frames = stylesheet.slice(stylesheet.indexOf('@keyframes dg-flash-fade'))
        const body = frames.slice(0, frames.indexOf('.dg-flash'))

        expect(body).not.toMatch(/outline|border/)
        expect(body).toContain('inset')
    })

    it('drives the fade from the property the feature sets, not a fixed time', () => {
        expect(stylesheet).toMatch(/animation:\s*dg-flash-fade var\(--dg-flash-ms/)
    })

    it('turns the animation off for a reader who asked for less motion', () => {
        const guard = stylesheet.slice(stylesheet.indexOf('prefers-reduced-motion'))

        expect(guard).toContain('.dg-flash')
        expect(guard).toMatch(/animation:\s*none/)
    })

    it('leaves the wash to the feature, so a grid without it still marks', () => {
        const rule = stylesheet.slice(stylesheet.indexOf('.dg-flash {'))
        const body = rule.slice(0, rule.indexOf('}'))

        expect(body).not.toMatch(/box-shadow:/)
        expect(body).toMatch(/animation:/)
    })

    it('leaves the pseudo-elements to the range and the cut', () => {
        const rule = stylesheet.slice(stylesheet.indexOf('.dg-flash'))

        expect(rule).not.toMatch(/\.dg-flash::(before|after)/)
    })
})

describe('the slot a flash is restyled through', () => {
    it('carries the class the feature puts on a marked cell', () => {
        expect(slotClass('flashCell')).toContain('dg-flash')
    })

    it('takes an app-wide override beside it, rather than instead of it', () => {
        try {
            defineDataGridConfig({ slots: { flashCell: 'outline-dashed' } })

            expect(slotClass('flashCell')).toContain('dg-flash')
            expect(slotClass('flashCell')).toContain('outline-dashed')
        } finally {
            resetDataGridConfig()
        }
    })

    it('goes back to the default once the config is reset', () => {
        defineDataGridConfig({ slots: { flashCell: 'outline-dashed' } })
        resetDataGridConfig()

        expect(slotClass('flashCell')).toBe('dg-flash')
    })
})
