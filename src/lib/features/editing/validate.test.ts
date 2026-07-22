import type { StandardSchemaV1 } from '@standard-schema/spec'
import { describe, expect, it } from 'vitest'
import type { ColumnDef } from '../../core/types/index.js'
import { isPromise, runValidation } from './validate.js'

interface Row {
    name: string
}

function schema(check: (value: unknown) => string | null, async = false): StandardSchemaV1 {
    return {
        '~standard': {
            version: 1,
            vendor: 'test',
            validate: (value: unknown) => {
                const message = check(value)
                const result = message
                    ? { issues: [{ message }] }
                    : { value: typeof value === 'string' ? value.trim() : value }
                return async ? Promise.resolve(result) : result
            }
        }
    }
}

describe('runValidation', () => {
    it('passes through when no schema or validate is set', () => {
        const result = runValidation('x', { name: 'x' }, { id: 'name' })
        expect(result).toEqual({ error: null, value: 'x' })
    })

    it('uses an imperative validate function', () => {
        const def: ColumnDef<Row> = {
            id: 'name',
            validate: (value) => (String(value).length < 2 ? 'too short' : null)
        }
        expect(runValidation('a', { name: 'a' }, def)).toEqual({ error: 'too short', value: 'a' })
        expect(runValidation('ab', { name: 'ab' }, def)).toEqual({ error: null, value: 'ab' })
    })

    it('reports the first issue message from a sync standard-schema', () => {
        const def: ColumnDef<Row> = {
            id: 'name',
            schema: schema((value) => (value === '' ? 'required' : null))
        }
        expect(runValidation('', { name: '' }, def)).toEqual({ error: 'required', value: '' })
    })

    it('returns the schema-parsed output on success', () => {
        const def: ColumnDef<Row> = { id: 'name', schema: schema(() => null) }
        expect(runValidation('  hi  ', { name: '' }, def)).toEqual({ error: null, value: 'hi' })
    })

    it('supports async schemas via a Promise', async () => {
        const def: ColumnDef<Row> = {
            id: 'name',
            schema: schema((value) => (value === 'bad' ? 'nope' : null), true)
        }
        const result = runValidation('bad', { name: 'bad' }, def)
        expect(isPromise(result)).toBe(true)
        await expect(result).resolves.toEqual({ error: 'nope', value: 'bad' })
    })
})
