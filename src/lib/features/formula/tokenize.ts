export type TokenKind = 'number' | 'string' | 'name' | 'operator' | 'punct' | 'end'

export interface Token {
    kind: TokenKind
    text: string
    at: number
}

export class FormulaSyntaxError extends Error {
    readonly at: number

    constructor(message: string, at: number) {
        super(message)
        this.name = 'FormulaSyntaxError'
        this.at = at
    }
}

export const MAX_SOURCE_LENGTH = 2_000

const TWO_CHAR = ['<=', '>=', '<>', '!=', '==']
const ONE_CHAR = '+-*/%^&=<>'
const PUNCT = '(),'

const isDigit = (char: string): boolean => char >= '0' && char <= '9'

const isNameStart = (char: string): boolean =>
    (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_'

const isNamePart = (char: string): boolean => isNameStart(char) || isDigit(char) || char === '.'

function skipDigits(source: string, start: number): number {
    let index = start
    while (index < source.length && isDigit(source[index]!)) index++
    return index
}

function readExponent(source: string, start: number): number {
    if (source[start] !== 'e' && source[start] !== 'E') return start

    let index = start + 1
    if (source[index] === '+' || source[index] === '-') index++

    const digits = skipDigits(source, index)
    return digits === index ? start : digits
}

function readNumber(source: string, start: number): number {
    const whole = skipDigits(source, start)
    const withFraction = source[whole] === '.' ? skipDigits(source, whole + 1) : whole
    return readExponent(source, withFraction)
}

function readQuoted(source: string, start: number): number {
    const quote = source[start]!
    let index = start + 1

    while (index < source.length) {
        if (source[index] === quote) {
            if (source[index + 1] === quote) {
                index += 2
                continue
            }
            return index + 1
        }
        index++
    }

    throw new FormulaSyntaxError('unterminated text: the quote is never closed', start)
}

function readBracketed(source: string, start: number): number {
    const end = source.indexOf(']', start + 1)
    if (end === -1) {
        throw new FormulaSyntaxError('unterminated column name: the "]" is missing', start)
    }
    return end + 1
}

export function unquote(text: string): string {
    const quote = text[0]!
    return text.slice(1, -1).split(`${quote}${quote}`).join(quote)
}

export function unbracket(text: string): string {
    return text.slice(1, -1).trim()
}

function operatorAt(source: string, index: number): string | undefined {
    const two = source.slice(index, index + 2)
    if (TWO_CHAR.includes(two)) return two

    const one = source[index]!
    return ONE_CHAR.includes(one) ? one : undefined
}

const isSpace = (char: string): boolean =>
    char === ' ' || char === '\t' || char === '\n' || char === '\r'

function readName(source: string, start: number): number {
    let index = start + 1
    while (index < source.length && isNamePart(source[index]!)) index++
    return index
}

type Span = { kind: TokenKind; end: number } | undefined

const startsNumber = (source: string, index: number): boolean =>
    isDigit(source[index]!) || (source[index] === '.' && isDigit(source[index + 1] ?? ''))

const SCANNERS: ((source: string, index: number) => Span)[] = [
    (source, index) =>
        startsNumber(source, index)
            ? { kind: 'number', end: readNumber(source, index) }
            : undefined,
    (source, index) =>
        source[index] === '"' || source[index] === "'"
            ? { kind: 'string', end: readQuoted(source, index) }
            : undefined,
    (source, index) =>
        source[index] === '[' ? { kind: 'name', end: readBracketed(source, index) } : undefined,
    (source, index) =>
        isNameStart(source[index]!) ? { kind: 'name', end: readName(source, index) } : undefined,
    (source, index) =>
        PUNCT.includes(source[index]!) ? { kind: 'punct', end: index + 1 } : undefined,
    (source, index) => {
        const operator = operatorAt(source, index)
        return operator ? { kind: 'operator', end: index + operator.length } : undefined
    }
]

function spanAt(source: string, index: number): Span {
    for (const scan of SCANNERS) {
        const span = scan(source, index)
        if (span) return span
    }
    return undefined
}

export function tokenize(source: string): Token[] {
    if (source.length > MAX_SOURCE_LENGTH) {
        throw new FormulaSyntaxError(
            `formula is ${source.length} characters, over the ${MAX_SOURCE_LENGTH} limit`,
            0
        )
    }

    const tokens: Token[] = []
    let index = 0

    while (index < source.length) {
        if (isSpace(source[index]!)) {
            index++
            continue
        }

        const span = spanAt(source, index)
        if (!span) throw new FormulaSyntaxError(`unexpected character "${source[index]}"`, index)

        tokens.push({ kind: span.kind, text: source.slice(index, span.end), at: index })
        index = span.end
    }

    tokens.push({ kind: 'end', text: '', at: source.length })
    return tokens
}
