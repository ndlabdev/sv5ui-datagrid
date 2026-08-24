import { describe, expect, it } from 'vitest'
import { inlineStyle } from './style.js'

describe('inlineStyle', () => {
    it('writes a declaration per entry', () => {
        expect(inlineStyle({ 'background-color': 'red', color: 'white' })).toBe(
            'background-color:red;color:white;'
        )
    })

    it('carries custom properties, which is how a feature reaches a pseudo-element', () => {
        expect(inlineStyle({ '--dg-bar': '42%' })).toBe('--dg-bar:42%;')
    })

    it('is undefined when there is nothing to write', () => {
        expect(inlineStyle(undefined)).toBeUndefined()
        expect(inlineStyle({})).toBeUndefined()
        expect(inlineStyle({ color: '   ' })).toBeUndefined()
    })

    // Guards the one thing row data could do here: open a second declaration.
    it('keeps a value from becoming two declarations', () => {
        expect(inlineStyle({ color: 'red;position:fixed' })).toBe('color:red;')
    })

    it('drops a property name that is not one', () => {
        expect(inlineStyle({ 'color:red;position': 'fixed' })).toBeUndefined()
    })
})
