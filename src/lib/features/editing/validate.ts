import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { ColumnDef } from '../../core/types.js'

export interface Validated {
    /** Error message when invalid, null when valid. */
    error: string | null
    /** The schema's parsed output when valid, else the input value. */
    value: unknown
}

function fromSchemaResult(result: StandardSchemaV1.Result<unknown>, input: unknown): Validated {
    if (result.issues && result.issues.length > 0) {
        return { error: result.issues[0].message, value: input }
    }
    return { error: null, value: (result as { value: unknown }).value }
}

/**
 * Validates a committed value against a column's `schema` (standard-schema)
 * or imperative `validate`. Returns synchronously when the schema is
 * synchronous; a Promise only when the schema itself is async.
 */
export function runValidation<TRow>(
    value: unknown,
    row: TRow,
    def: ColumnDef<TRow>
): Validated | Promise<Validated> {
    if (def.validate) {
        return { error: def.validate(value, row), value }
    }
    if (def.schema) {
        const result = def.schema['~standard'].validate(value)
        if (result instanceof Promise) {
            return result.then((resolved) => fromSchemaResult(resolved, value))
        }
        return fromSchemaResult(result, value)
    }
    return { error: null, value }
}

export function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
    return value instanceof Promise
}
