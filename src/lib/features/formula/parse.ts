import { FormulaSyntaxError, type Token, tokenize, unbracket, unquote } from './tokenize.js'

export type Node =
    | { kind: 'literal'; value: number | string | boolean | null }
    | { kind: 'column'; id: string; at: number }
    | { kind: 'unary'; operator: '-' | '+' | 'not'; operand: Node }
    | { kind: 'binary'; operator: BinaryOperator; left: Node; right: Node }
    | { kind: 'call'; name: string; args: Node[]; at: number }

export type BinaryOperator =
    '+' | '-' | '*' | '/' | '%' | '^' | '&' | '=' | '<>' | '<' | '<=' | '>' | '>=' | 'and' | 'or'

export const MAX_DEPTH = 32
export const MAX_NODES = 512

const BINDING = new Map<string, number>([
    ['or', 1],
    ['and', 2],
    ['=', 3],
    ['<>', 3],
    ['<', 3],
    ['<=', 3],
    ['>', 3],
    ['>=', 3],
    ['&', 4],
    ['+', 5],
    ['-', 5],
    ['*', 6],
    ['/', 6],
    ['%', 6],
    ['^', 7]
])

const RIGHT_ASSOCIATIVE = new Set(['^'])

const KEYWORDS = new Map<string, Node>([
    ['true', { kind: 'literal', value: true }],
    ['false', { kind: 'literal', value: false }],
    ['null', { kind: 'literal', value: null }],
    ['blank', { kind: 'literal', value: null }]
])

const NORMALIZED = new Map<string, BinaryOperator>([
    ['==', '='],
    ['!=', '<>']
])

class Parser {
    #tokens: Token[]
    #index = 0
    #nodes = 0

    constructor(source: string) {
        this.#tokens = tokenize(source)
    }

    #peek(): Token {
        return this.#tokens[this.#index]!
    }

    #next(): Token {
        return this.#tokens[this.#index++]!
    }

    #count(token: Token): void {
        this.#nodes++
        if (this.#nodes > MAX_NODES) {
            throw new FormulaSyntaxError(
                `formula has more than ${MAX_NODES} parts, which is past what this evaluates`,
                token.at
            )
        }
    }

    #operatorOf(token: Token): BinaryOperator | undefined {
        if (token.kind === 'operator') {
            const text = NORMALIZED.get(token.text) ?? (token.text as BinaryOperator)
            return BINDING.has(text) ? text : undefined
        }
        if (token.kind === 'name') {
            const word = token.text.toLowerCase()
            if (word === 'and' || word === 'or') return word
        }
        return undefined
    }

    parse(): Node {
        const node = this.#expression(0, 0)
        const token = this.#peek()
        if (token.kind !== 'end') {
            throw new FormulaSyntaxError(`unexpected "${token.text}"`, token.at)
        }
        return node
    }

    #expression(minBinding: number, depth: number): Node {
        if (depth > MAX_DEPTH) {
            throw new FormulaSyntaxError(
                `formula nests deeper than ${MAX_DEPTH} levels`,
                this.#peek().at
            )
        }

        let left = this.#prefix(depth)

        for (;;) {
            const token = this.#peek()
            const operator = this.#operatorOf(token)
            if (!operator) break

            const binding = BINDING.get(operator)!
            if (binding < minBinding) break

            this.#next()
            this.#count(token)

            const nextBinding = RIGHT_ASSOCIATIVE.has(operator) ? binding : binding + 1
            const right = this.#expression(nextBinding, depth + 1)
            left = { kind: 'binary', operator, left, right }
        }

        return left
    }

    #numberNode(token: Token): Node {
        const value = Number(token.text)
        if (Number.isNaN(value)) {
            throw new FormulaSyntaxError(`"${token.text}" is not a number`, token.at)
        }
        return { kind: 'literal', value }
    }

    #signNode(token: Token, depth: number): Node {
        if (token.text !== '-' && token.text !== '+') {
            throw new FormulaSyntaxError(`"${token.text}" needs a value before it`, token.at)
        }
        const operand = this.#expression(BINDING.get('^')!, depth + 1)
        return { kind: 'unary', operator: token.text, operand }
    }

    #groupNode(token: Token, depth: number): Node {
        if (token.text !== '(') {
            throw new FormulaSyntaxError(`unexpected "${token.text}"`, token.at)
        }
        const inner = this.#expression(0, depth + 1)
        this.#expect(')')
        return inner
    }

    #prefix(depth: number): Node {
        const token = this.#next()
        this.#count(token)

        switch (token.kind) {
            case 'number':
                return this.#numberNode(token)
            case 'string':
                return { kind: 'literal', value: unquote(token.text) }
            case 'operator':
                return this.#signNode(token, depth)
            case 'punct':
                return this.#groupNode(token, depth)
            case 'name':
                return this.#name(token, depth)
            default:
                throw new FormulaSyntaxError('the formula ends too early', token.at)
        }
    }

    #name(token: Token, depth: number): Node {
        if (token.text.startsWith('[')) {
            const id = unbracket(token.text)
            if (id === '') throw new FormulaSyntaxError('empty column name', token.at)
            return { kind: 'column', id, at: token.at }
        }

        const word = token.text.toLowerCase()

        if (word === 'not') {
            const operand = this.#expression(BINDING.get('=')!, depth + 1)
            return { kind: 'unary', operator: 'not', operand }
        }

        const next = this.#peek()
        if (next.kind === 'punct' && next.text === '(') {
            this.#next()
            return { kind: 'call', name: word, args: this.#arguments(depth), at: token.at }
        }

        const keyword = KEYWORDS.get(word)
        if (keyword) return keyword

        return { kind: 'column', id: token.text, at: token.at }
    }

    #arguments(depth: number): Node[] {
        const args: Node[] = []

        const first = this.#peek()
        if (first.kind === 'punct' && first.text === ')') {
            this.#next()
            return args
        }

        for (;;) {
            args.push(this.#expression(0, depth + 1))
            const token = this.#next()

            if (token.kind === 'punct' && token.text === ')') return args
            if (token.kind === 'punct' && token.text === ',') continue

            throw new FormulaSyntaxError(
                token.kind === 'end' ? 'a ")" is missing' : 'expected "," or ")"',
                token.at
            )
        }
    }

    #expect(text: string): void {
        const token = this.#next()
        if (token.text !== text) {
            throw new FormulaSyntaxError(
                token.kind === 'end' ? `a "${text}" is missing` : `expected "${text}"`,
                token.at
            )
        }
    }
}

export function parse(source: string): Node {
    return new Parser(source).parse()
}

export function columnsUsed(node: Node): string[] {
    const found = new Set<string>()

    const walk = (current: Node): void => {
        switch (current.kind) {
            case 'column':
                found.add(current.id)
                return
            case 'unary':
                walk(current.operand)
                return
            case 'binary':
                walk(current.left)
                walk(current.right)
                return
            case 'call':
                for (const argument of current.args) walk(argument)
                return
            default:
                return
        }
    }

    walk(node)
    return [...found]
}
