import { describe, expect, it } from 'vitest'
import { evaluate, type FormulaError, type FormulaValue, isFormulaError } from './evaluate.js'
import { columnsUsed, MAX_DEPTH, MAX_NODES, parse } from './parse.js'
import { FormulaSyntaxError, MAX_SOURCE_LENGTH, tokenize } from './tokenize.js'

function run(source: string, row: Record<string, unknown> = {}): FormulaValue {
    return evaluate(parse(source), { column: (id) => row[id] })
}

function runOwn(source: string, row: Record<string, unknown> = {}): FormulaValue {
    return evaluate(parse(source), {
        column: (id) => (Object.hasOwn(row, id) ? row[id] : null)
    })
}

const code = (value: FormulaValue): string =>
    isFormulaError(value) ? value.code : `not an error: ${String(value)}`

describe('tokenizer', () => {
    it('reads the number shapes a person actually types', () => {
        expect(tokenize('1 2.5 .5 1e3 1.5e-2').filter((t) => t.kind === 'number')).toHaveLength(5)
        expect(run('1e3')).toBe(1000)
        expect(run('.5')).toBe(0.5)
        expect(run('1.5e-2')).toBe(0.015)
    })

    it('does not mistake a trailing e for an exponent', () => {
        expect(run('2 & "e"')).toBe('2e')
    })

    it('takes a doubled quote as one quote inside text', () => {
        expect(run('"she said ""hi"""')).toBe('she said "hi"')
        expect(run("'it''s'")).toBe("it's")
    })

    it('refuses text whose quote is never closed', () => {
        expect(() => tokenize('"open')).toThrow(FormulaSyntaxError)
    })

    it('refuses a column name whose bracket is never closed', () => {
        expect(() => tokenize('[open')).toThrow(FormulaSyntaxError)
    })

    it('points at where the trouble is', () => {
        try {
            tokenize('1 + #')
            expect.unreachable()
        } catch (error) {
            expect(error).toBeInstanceOf(FormulaSyntaxError)
            expect((error as FormulaSyntaxError).at).toBe(4)
        }
    })

    it('caps the source so a pasted novel cannot be parsed', () => {
        expect(() => tokenize('1+'.repeat(MAX_SOURCE_LENGTH))).toThrow(/over the .* limit/)
    })
})

describe('precedence and associativity', () => {
    it('multiplies before it adds', () => {
        expect(run('2 + 3 * 4')).toBe(14)
        expect(run('(2 + 3) * 4')).toBe(20)
    })

    it('raises to a power right to left, the way maths does', () => {
        expect(run('2 ^ 3 ^ 2')).toBe(512)
    })

    it('subtracts left to right', () => {
        expect(run('10 - 3 - 2')).toBe(5)
    })

    it('compares after it does arithmetic', () => {
        expect(run('1 + 1 = 2')).toBe(true)
        expect(run('2 * 3 > 5')).toBe(true)
    })

    it('joins text after arithmetic but before comparison', () => {
        expect(run('"a" & 1 + 1')).toBe('a2')
        expect(run('"a" & "b" = "ab"')).toBe(true)
    })

    it('puts AND above OR', () => {
        expect(run('true OR false AND false')).toBe(true)
        expect(run('(true OR false) AND false')).toBe(false)
    })

    it('reads -x^2 as -(x^2), the way maths does rather than the way Excel does', () => {
        expect(run('-2 * 3')).toBe(-6)
        expect(run('-2 ^ 2')).toBe(-4)
        expect(run('(-2) ^ 2')).toBe(4)
    })

    it('accepts both spellings of equality and inequality', () => {
        expect(run('1 = 1')).toBe(true)
        expect(run('1 == 1')).toBe(true)
        expect(run('1 <> 2')).toBe(true)
        expect(run('1 != 2')).toBe(true)
    })
})

describe('column references', () => {
    it('reads a bare name as a column', () => {
        expect(run('price * qty', { price: 3, qty: 4 })).toBe(12)
    })

    it('reads a bracketed name, so an id may hold spaces', () => {
        expect(run('[unit price] * 2', { 'unit price': 5 })).toBe(10)
    })

    it('reports every column a formula depends on', () => {
        expect(columnsUsed(parse('IF(a > b, a & [c d], SUM(a, e))')).sort()).toEqual([
            'a',
            'b',
            'c d',
            'e'
        ])
    })

    it('treats a missing column as blank rather than failing', () => {
        expect(run('missing + 1')).toBe(1)
        expect(run('ISBLANK(missing)')).toBe(true)
    })
})

describe('Excel-shaped coercion', () => {
    it('counts blank as zero in arithmetic and empty in text', () => {
        expect(run('x + 5', { x: null })).toBe(5)
        expect(run('"[" & x & "]"', { x: null })).toBe('[]')
    })

    it('reads a numeric string as a number', () => {
        expect(run('x * 2', { x: '21' })).toBe(42)
    })

    it('refuses a string that is not a number', () => {
        expect(code(run('x * 2', { x: 'abc' }))).toBe('#VALUE')
    })

    it('compares two strings as text, not as numbers', () => {
        expect(run('"10" < "9"')).toBe(true)
        expect(run('10 < 9')).toBe(false)
    })

    it('compares dates by their instant', () => {
        const early = new Date(2026, 0, 1)
        const late = new Date(2026, 6, 1)
        expect(run('a < b', { a: early, b: late })).toBe(true)
        expect(run('a = b', { a: early, b: new Date(2026, 0, 1) })).toBe(true)
    })

    it('pulls the parts out of a date', () => {
        expect(run('YEAR(d)', { d: new Date(2026, 7, 17) })).toBe(2026)
        expect(run('MONTH(d)', { d: new Date(2026, 7, 17) })).toBe(8)
        expect(run('DAY(d)', { d: new Date(2026, 7, 17) })).toBe(17)
    })

    it('says plainly that date arithmetic is not in this version', () => {
        expect(code(run('d + 1', { d: new Date(2026, 0, 1) }))).toBe('#VALUE')
    })
})

describe('errors are values, not exceptions', () => {
    it('returns a division error rather than throwing', () => {
        expect(code(run('1 / 0'))).toBe('#DIV/0')
        expect(code(run('1 % 0'))).toBe('#DIV/0')
    })

    it('names a function it does not have', () => {
        const result = run('VLOOKUP(1)')
        expect(code(result)).toBe('#NAME')
        expect((result as FormulaError).detail).toContain('VLOOKUP'.toLowerCase())
    })

    it('carries an error up through the expression around it', () => {
        expect(code(run('1 + (2 / 0)'))).toBe('#DIV/0')
        expect(code(run('ROUND(1 / 0, 2)'))).toBe('#DIV/0')
    })

    it('lets ISERROR see the error instead of being swallowed by it', () => {
        expect(run('ISERROR(1 / 0)')).toBe(true)
        expect(run('ISERROR(1)')).toBe(false)
    })

    it('reports a number that ran off the end of what a double holds', () => {
        expect(code(run('10 ^ 400'))).toBe('#NUM')
    })

    it('prints as its code, so a cell shows #DIV/0', () => {
        expect(String(run('1 / 0'))).toBe('#DIV/0')
    })
})

describe('IF chooses a branch instead of running both', () => {
    it('does not divide by zero on the branch it did not take', () => {
        expect(run('IF(x = 0, 0, 100 / x)', { x: 0 })).toBe(0)
        expect(run('IF(x = 0, 0, 100 / x)', { x: 4 })).toBe(25)
    })

    it('returns blank when the branch is missing', () => {
        expect(run('IF(false, 1)')).toBe(null)
    })
})

describe('functions', () => {
    it('does the numeric ones', () => {
        expect(run('ABS(-3)')).toBe(3)
        expect(run('ROUND(3.14159, 2)')).toBe(3.14)
        expect(run('ROUND(3.7)')).toBe(4)
        expect(run('FLOOR(3.7)')).toBe(3)
        expect(run('CEILING(3.2)')).toBe(4)
        expect(run('SQRT(9)')).toBe(3)
        expect(run('SIGN(-2)')).toBe(-1)
    })

    it('does the aggregate-shaped ones over their arguments', () => {
        expect(run('SUM(1, 2, 3)')).toBe(6)
        expect(run('MIN(4, 2, 9)')).toBe(2)
        expect(run('MAX(4, 2, 9)')).toBe(9)
        expect(run('AVERAGE(2, 4)')).toBe(3)
    })

    it('skips blanks rather than counting them as zero in an average', () => {
        expect(run('AVERAGE(a, b, c)', { a: 2, b: null, c: 4 })).toBe(3)
        expect(run('SUM(a, b)', { a: null, b: null })).toBe(null)
    })

    it('does the text ones', () => {
        expect(run('LEN("hello")')).toBe(5)
        expect(run('UPPER("ab")')).toBe('AB')
        expect(run('LOWER("AB")')).toBe('ab')
        expect(run('TRIM("  x  ")')).toBe('x')
        expect(run('LEFT("hello", 2)')).toBe('he')
        expect(run('RIGHT("hello", 2)')).toBe('lo')
        expect(run('CONCAT("a", 1, true)')).toBe('a1true')
    })

    it('matches text without caring about case, which is what a filter wants', () => {
        expect(run('CONTAINS("Hello World", "world")')).toBe(true)
        expect(run('STARTSWITH("Hello", "he")')).toBe(true)
        expect(run('CONTAINS("Hello", "xyz")')).toBe(false)
    })

    it('takes the first thing that is neither blank nor empty', () => {
        expect(run('COALESCE(a, b, "fallback")', { a: null, b: '' })).toBe('fallback')
        expect(run('COALESCE(a, b)', { a: null, b: 7 })).toBe(7)
    })

    it('refuses a negative length rather than returning nonsense', () => {
        expect(code(run('LEFT("abc", -1)'))).toBe('#NUM')
    })
})

describe('limits that keep one bad formula from taking the tab down', () => {
    it('refuses to nest past the depth it can walk', () => {
        const deep = '('.repeat(MAX_DEPTH + 5) + '1' + ')'.repeat(MAX_DEPTH + 5)
        expect(() => parse(deep)).toThrow(/nests deeper/)
    })

    it('survives what it does accept, rather than overflowing the stack', () => {
        const allowed = '('.repeat(MAX_DEPTH - 2) + '1' + ')'.repeat(MAX_DEPTH - 2)
        expect(run(allowed)).toBe(1)
    })

    it('refuses a formula with more parts than it will evaluate', () => {
        const dense = Array(MAX_NODES + 10)
            .fill('1')
            .join('+')
        expect(dense.length).toBeLessThan(MAX_SOURCE_LENGTH)
        expect(() => parse(dense)).toThrow(/more than/)
    })

    it('caps a string a formula builds, rather than letting it eat the heap', () => {
        const long = 'x'.repeat(20_000)
        expect(code(run('a & a', { a: long }))).toBe('#LIMIT')
    })
})

describe('the evaluator cannot be walked out of into JavaScript', () => {
    it('does not find a function on Object.prototype', () => {
        for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
            expect(code(run(`${name}(1)`))).toBe('#NAME')
        }
    })

    it('does not resolve a keyword off the prototype chain either', () => {
        const node = parse('constructor')
        expect(node).toEqual({ kind: 'column', id: 'constructor', at: 0 })
    })

    it('treats such a name as an ordinary column the app may or may not have', () => {
        expect(runOwn('constructor & ""', {})).toBe('')
        expect(runOwn('constructor & ""', { constructor: 'mine' })).toBe('mine')
    })

    it('never lets a function reach a cell, even from a careless value lookup', () => {
        expect(run('constructor & ""', {})).toBe('')
        expect(run('ISBLANK(toString)', {})).toBe(true)
        expect(evaluate(parse('x'), { column: () => () => 'boom' })).toBe(null)
    })

    it('never hands a formula anything but the values the context returns', () => {
        const seen: string[] = []
        evaluate(parse('a + b'), {
            column: (id) => {
                seen.push(id)
                return 1
            }
        })
        expect(seen).toEqual(['a', 'b'])
    })
})

describe('syntax errors say what is wrong and where', () => {
    it.each([
        ['1 +', 'ends too early'],
        ['1 + + ', 'ends too early'],
        ['(1', 'missing'],
        ['SUM(1,', 'ends too early'],
        ['1 2', 'unexpected'],
        ['* 1', 'needs a value before it'],
        ['[]', 'empty column name']
    ])('rejects %j', (source, message) => {
        expect(() => parse(source)).toThrow(new RegExp(message))
    })

    it('accepts a function called with nothing', () => {
        expect(run('SUM()')).toBe(null)
    })
})
