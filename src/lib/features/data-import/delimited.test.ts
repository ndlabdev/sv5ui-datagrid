import { describe, expect, it } from 'vitest'
import { looksLikeHeader, parseDelimited, sniffDelimiter } from './delimited.js'

describe('reading a delimited file', () => {
    it('reads the plain case', () => {
        expect(parseDelimited('a,b\n1,2')).toEqual([
            ['a', 'b'],
            ['1', '2']
        ])
    })

    it('keeps a delimiter that is inside quotes', () => {
        expect(parseDelimited('name,note\n"Chi, An",hi')).toEqual([
            ['name', 'note'],
            ['Chi, An', 'hi']
        ])
    })

    it('keeps a newline that is inside quotes', () => {
        expect(parseDelimited('a\n"one\ntwo"')).toEqual([['a'], ['one\ntwo']])
    })

    it('reads a doubled quote as one quote', () => {
        expect(parseDelimited('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']])
    })

    it('takes CRLF the same way as LF', () => {
        expect(parseDelimited('a,b\r\n1,2\r\n')).toEqual([
            ['a', 'b'],
            ['1', '2']
        ])
    })

    it('drops the byte order mark a spreadsheet writes', () => {
        expect(parseDelimited('﻿id,name\n1,Chi')[0]).toEqual(['id', 'name'])
    })

    it('keeps an empty trailing field rather than losing the column', () => {
        expect(parseDelimited('a,b,c\n1,,3')).toEqual([
            ['a', 'b', 'c'],
            ['1', '', '3']
        ])
    })

    it('drops the blank line a file ends with', () => {
        expect(parseDelimited('a,b\n1,2\n\n')).toHaveLength(2)
    })

    it('reads a tab file without being told', () => {
        expect(parseDelimited('a\tb\n1\t2')).toEqual([
            ['a', 'b'],
            ['1', '2']
        ])
    })

    it('refuses a file past the row cap instead of freezing', () => {
        const many = Array.from({ length: 40 }, (_, i) => `${i}`).join('\n')
        expect(() => parseDelimited(many, { maxRows: 10 })).toThrow(/more than 10 rows/)
    })

    it('refuses a file past the cell cap', () => {
        expect(() => parseDelimited('a,b,c\n1,2,3', { maxCells: 4 })).toThrow(/cells/)
    })
})

describe('which delimiter a file uses', () => {
    it.each([
        ['a,b,c', ','],
        ['a\tb\tc', '\t'],
        ['a;b;c', ';'],
        ['a|b|c', '|'],
        ['"a,b";c;d', ';']
    ])('reads %s as %s', (line, expected) => {
        expect(sniffDelimiter(line)).toBe(expected)
    })
})

describe('whether the first row is a header', () => {
    it('says yes to distinct words over data', () => {
        expect(
            looksLikeHeader([
                ['id', 'name'],
                ['1', 'Chi']
            ])
        ).toBe(true)
    })

    it('says no when the first row is numbers', () => {
        expect(
            looksLikeHeader([
                ['1', '2'],
                ['3', '4']
            ])
        ).toBe(false)
    })

    it('says no when a name repeats, which a header does not', () => {
        expect(
            looksLikeHeader([
                ['id', 'id'],
                ['1', '2']
            ])
        ).toBe(false)
    })

    it('says no to a single row, which is data or nothing', () => {
        expect(looksLikeHeader([['id', 'name']])).toBe(false)
    })
})
