import type { BinaryOperator, Node } from './parse.js'

export type FormulaValue = number | string | boolean | Date | null | FormulaError

export type FormulaErrorCode = '#VALUE' | '#DIV/0' | '#NAME' | '#NUM' | '#LIMIT' | '#CYCLE'

export class FormulaError {
    readonly code: FormulaErrorCode
    readonly detail: string

    constructor(code: FormulaErrorCode, detail: string) {
        this.code = code
        this.detail = detail
    }

    toString(): string {
        return this.code
    }
}

const MAX_TEXT_LENGTH = 32_767

export const isFormulaError = (value: unknown): value is FormulaError =>
    value instanceof FormulaError

interface EvaluateContext {
    column: (id: string) => unknown
}

const VALUE = (detail: string) => new FormulaError('#VALUE', detail)

function firstError(values: FormulaValue[]): FormulaError | undefined {
    for (const value of values) if (isFormulaError(value)) return value
    return undefined
}

function toNumber(value: FormulaValue): number | FormulaError {
    if (isFormulaError(value)) return value
    if (value === null || value === '') return 0
    if (typeof value === 'number') return Number.isFinite(value) ? value : VALUE('not a number')
    if (typeof value === 'boolean') return value ? 1 : 0
    if (value instanceof Date) return VALUE('a date has no arithmetic in this version')

    const parsed = Number(value)
    return Number.isNaN(parsed) ? VALUE(`"${value}" is not a number`) : parsed
}

const isInvalidDate = (value: unknown): boolean =>
    value instanceof Date && Number.isNaN(value.getTime())

function toText(value: FormulaValue): string | FormulaError {
    if (isFormulaError(value)) return value
    if (value === null) return ''
    if (value instanceof Date) {
        return isInvalidDate(value) ? VALUE('not a date') : value.toISOString()
    }
    return String(value)
}

function toBoolean(value: FormulaValue): boolean | FormulaError {
    if (isFormulaError(value)) return value
    if (value === null) return false
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') return value !== ''
    return true
}

function capped(text: string): string | FormulaError {
    return text.length > MAX_TEXT_LENGTH
        ? new FormulaError('#LIMIT', `text longer than ${MAX_TEXT_LENGTH} characters`)
        : text
}

function compareNumeric(left: FormulaValue, right: FormulaValue): number | FormulaError {
    const a = toNumber(left)
    if (isFormulaError(a)) return a
    const b = toNumber(right)
    if (isFormulaError(b)) return b
    return a - b
}

function compareText(left: string, right: string): number {
    if (left === right) return 0
    return left < right ? -1 : 1
}

function compare(left: FormulaValue, right: FormulaValue): number | FormulaError {
    if (isInvalidDate(left) || isInvalidDate(right)) return VALUE('not a date')
    if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime()
    if (typeof left === 'string' && typeof right === 'string') return compareText(left, right)
    if (left === null && right === null) return 0
    return compareNumeric(left, right)
}

function equals(left: FormulaValue, right: FormulaValue): boolean | FormulaError {
    if (left instanceof Date || right instanceof Date) {
        const order = compare(left, right)
        return isFormulaError(order) ? order : order === 0
    }
    if (typeof left === 'string' || typeof right === 'string') {
        const a = toText(left)
        if (isFormulaError(a)) return a
        const b = toText(right)
        if (isFormulaError(b)) return b
        return a === b
    }
    const order = compare(left, right)
    return isFormulaError(order) ? order : order === 0
}

function arithmetic(
    operator: BinaryOperator,
    left: FormulaValue,
    right: FormulaValue
): FormulaValue {
    const a = toNumber(left)
    if (isFormulaError(a)) return a
    const b = toNumber(right)
    if (isFormulaError(b)) return b

    switch (operator) {
        case '+':
            return a + b
        case '-':
            return a - b
        case '*':
            return a * b
        case '/':
            return b === 0 ? new FormulaError('#DIV/0', 'divided by zero') : a / b
        case '%':
            return b === 0 ? new FormulaError('#DIV/0', 'divided by zero') : a % b
        default:
            return finite(a ** b)
    }
}

function finite(value: number): FormulaValue {
    return Number.isFinite(value) ? value : new FormulaError('#NUM', 'result is out of range')
}

const ORDERING = new Map<string, (order: number) => boolean>([
    ['<', (order) => order < 0],
    ['<=', (order) => order <= 0],
    ['>', (order) => order > 0],
    ['>=', (order) => order >= 0]
])

function binary(operator: BinaryOperator, left: FormulaValue, right: FormulaValue): FormulaValue {
    if (operator === '&') {
        const a = toText(left)
        if (isFormulaError(a)) return a
        const b = toText(right)
        if (isFormulaError(b)) return b
        return capped(a + b)
    }

    if (operator === '=') return equals(left, right)
    if (operator === '<>') {
        const same = equals(left, right)
        return isFormulaError(same) ? same : !same
    }

    const ordering = ORDERING.get(operator)
    if (ordering) {
        const order = compare(left, right)
        return isFormulaError(order) ? order : ordering(order)
    }

    return arithmetic(operator, left, right)
}

type Fn = (args: FormulaValue[]) => FormulaValue

function numeric(args: FormulaValue[]): number[] | FormulaError {
    const numbers: number[] = []
    for (const argument of args) {
        if (argument === null) continue
        const value = toNumber(argument)
        if (isFormulaError(value)) return value
        numbers.push(value)
    }
    return numbers
}

function needText(args: FormulaValue[], index: number): string | FormulaError {
    return toText(args[index] ?? null)
}

function needNumber(args: FormulaValue[], index: number): number | FormulaError {
    return toNumber(args[index] ?? null)
}

function datePart(value: FormulaValue, part: (date: Date) => number): FormulaValue {
    if (isFormulaError(value)) return value
    if (value instanceof Date) return part(value)
    if (value === null) return null

    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? VALUE('not a date') : part(date)
}

function slice(
    args: FormulaValue[],
    from: (length: number, count: number) => [number, number]
): FormulaValue {
    const text = needText(args, 0)
    if (isFormulaError(text)) return text
    const count = needNumber(args, 1)
    if (isFormulaError(count)) return count
    if (count < 0) return new FormulaError('#NUM', 'a negative length')

    const [start, end] = from(text.length, Math.floor(count))
    return text.slice(start, end)
}

function reduceNumbers(args: FormulaValue[], run: (numbers: number[]) => number): FormulaValue {
    const numbers = numeric(args)
    if (isFormulaError(numbers)) return numbers
    return numbers.length === 0 ? null : finite(run(numbers))
}

const LAZY_FUNCTIONS = ['if']

const EAGER: Record<string, Fn> = {
    and: (args) => {
        for (const argument of args) {
            const value = toBoolean(argument)
            if (isFormulaError(value)) return value
            if (!value) return false
        }
        return true
    },
    or: (args) => {
        for (const argument of args) {
            const value = toBoolean(argument)
            if (isFormulaError(value)) return value
            if (value) return true
        }
        return false
    },
    not: (args) => {
        const value = toBoolean(args[0] ?? null)
        return isFormulaError(value) ? value : !value
    },
    coalesce: (args) => {
        for (const argument of args) {
            if (isFormulaError(argument)) return argument
            if (argument !== null && argument !== '') return argument
        }
        return null
    },
    isblank: (args) => {
        const value = args[0] ?? null
        if (isFormulaError(value)) return value
        return value === null || value === ''
    },
    iserror: (args) => isFormulaError(args[0] ?? null),

    abs: (args) => {
        const value = needNumber(args, 0)
        return isFormulaError(value) ? value : Math.abs(value)
    },
    sign: (args) => {
        const value = needNumber(args, 0)
        return isFormulaError(value) ? value : Math.sign(value)
    },
    sqrt: (args) => {
        const value = needNumber(args, 0)
        if (isFormulaError(value)) return value
        return value < 0 ? new FormulaError('#NUM', 'square root of a negative') : Math.sqrt(value)
    },
    round: (args) => {
        const value = needNumber(args, 0)
        if (isFormulaError(value)) return value
        const digits = args.length > 1 ? needNumber(args, 1) : 0
        if (isFormulaError(digits)) return digits
        const factor = 10 ** Math.max(0, Math.min(15, Math.floor(digits)))
        return Math.round(value * factor) / factor
    },
    floor: (args) => {
        const value = needNumber(args, 0)
        return isFormulaError(value) ? value : Math.floor(value)
    },
    ceiling: (args) => {
        const value = needNumber(args, 0)
        return isFormulaError(value) ? value : Math.ceil(value)
    },
    sum: (args) => reduceNumbers(args, (n) => n.reduce((total, value) => total + value, 0)),
    min: (args) => reduceNumbers(args, (n) => Math.min(...n)),
    max: (args) => reduceNumbers(args, (n) => Math.max(...n)),
    average: (args) =>
        reduceNumbers(args, (n) => n.reduce((total, value) => total + value, 0) / n.length),

    len: (args) => {
        const text = needText(args, 0)
        return isFormulaError(text) ? text : text.length
    },
    upper: (args) => {
        const text = needText(args, 0)
        return isFormulaError(text) ? text : text.toUpperCase()
    },
    lower: (args) => {
        const text = needText(args, 0)
        return isFormulaError(text) ? text : text.toLowerCase()
    },
    trim: (args) => {
        const text = needText(args, 0)
        return isFormulaError(text) ? text : text.trim()
    },
    left: (args) => slice(args, (_, count) => [0, count]),
    right: (args) => slice(args, (length, count) => [Math.max(0, length - count), length]),
    concat: (args) => {
        let out = ''
        for (const argument of args) {
            const text = toText(argument)
            if (isFormulaError(text)) return text
            out += text
            if (out.length > MAX_TEXT_LENGTH) return capped(out)
        }
        return out
    },
    contains: (args) => {
        const haystack = needText(args, 0)
        if (isFormulaError(haystack)) return haystack
        const needle = needText(args, 1)
        if (isFormulaError(needle)) return needle
        return haystack.toLowerCase().includes(needle.toLowerCase())
    },
    startswith: (args) => {
        const haystack = needText(args, 0)
        if (isFormulaError(haystack)) return haystack
        const needle = needText(args, 1)
        if (isFormulaError(needle)) return needle
        return haystack.toLowerCase().startsWith(needle.toLowerCase())
    },
    text: (args) => toText(args[0] ?? null),
    number: (args) => toNumber(args[0] ?? null),

    year: (args) => datePart(args[0] ?? null, (date) => date.getFullYear()),
    month: (args) => datePart(args[0] ?? null, (date) => date.getMonth() + 1),
    day: (args) => datePart(args[0] ?? null, (date) => date.getDate())
}

const FUNCTIONS = new Map<string, Fn>(Object.entries(EAGER))

export const FUNCTION_NAMES = [...LAZY_FUNCTIONS, ...FUNCTIONS.keys()]
    .map((name) => name.toUpperCase())
    .sort()

function toValue(raw: unknown): FormulaValue {
    if (raw === null || raw === undefined) return null
    if (typeof raw === 'number' || typeof raw === 'string' || typeof raw === 'boolean') return raw
    if (raw instanceof Date) return raw
    if (typeof raw === 'function' || typeof raw === 'symbol') return null
    return String(raw)
}

function evaluateUnary(
    node: Extract<Node, { kind: 'unary' }>,
    context: EvaluateContext
): FormulaValue {
    const operand = evaluate(node.operand, context)
    if (isFormulaError(operand)) return operand

    if (node.operator === 'not') {
        const value = toBoolean(operand)
        return isFormulaError(value) ? value : !value
    }

    const value = toNumber(operand)
    if (isFormulaError(value)) return value
    return node.operator === '-' ? -value : value
}

function evaluateBinary(
    node: Extract<Node, { kind: 'binary' }>,
    context: EvaluateContext
): FormulaValue {
    const left = evaluate(node.left, context)
    if (node.operator !== 'and' && node.operator !== 'or') {
        return binary(node.operator, left, evaluate(node.right, context))
    }

    const decided = toBoolean(left)
    if (isFormulaError(decided)) return decided
    if (decided !== (node.operator === 'and')) return decided
    return toBoolean(evaluate(node.right, context))
}

function evaluateIf(args: Node[], context: EvaluateContext): FormulaValue {
    const test = args[0]
    const condition = toBoolean(test ? evaluate(test, context) : null)
    if (isFormulaError(condition)) return condition

    const chosen = condition ? args[1] : args[2]
    return chosen ? evaluate(chosen, context) : null
}

function evaluateCall(
    node: Extract<Node, { kind: 'call' }>,
    context: EvaluateContext
): FormulaValue {
    if (node.name === 'if') return evaluateIf(node.args, context)

    const fn = FUNCTIONS.get(node.name)
    if (!fn) return new FormulaError('#NAME', `there is no function called "${node.name}"`)

    const args = node.args.map((argument) => evaluate(argument, context))
    if (node.name !== 'iserror') {
        const failed = firstError(args)
        if (failed) return failed
    }
    return fn(args)
}

export function evaluate(node: Node, context: EvaluateContext): FormulaValue {
    switch (node.kind) {
        case 'literal':
            return node.value
        case 'column':
            return toValue(context.column(node.id))
        case 'unary':
            return evaluateUnary(node, context)
        case 'binary':
            return evaluateBinary(node, context)
        case 'call':
            return evaluateCall(node, context)
    }
}
