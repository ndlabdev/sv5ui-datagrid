import type { WorkerQuery } from './query.js'

export interface LoadBeginMessage {
    type: 'load'
    fields: string[]
    textFields: string[]
    rowCount: number
}

export interface LoadChunkMessage {
    type: 'chunk'
    from: number
    values: Record<string, unknown[]>
    texts: Record<string, unknown[]>
}

export interface LoadEndMessage {
    type: 'loaded'
}

export interface QueryMessage {
    type: 'query'
    id: number
    startRow: number
    endRow: number
    query: WorkerQuery
}

export type ToWorker = LoadBeginMessage | LoadChunkMessage | LoadEndMessage | QueryMessage

export interface GroupDescriptor {
    keys: unknown[]
    count: number
}

export interface ResultMessage {
    type: 'result'
    id: number
    indices: number[]
    rowCount: number
    groups?: GroupDescriptor[]
}

export interface FailureMessage {
    type: 'failure'
    id: number
    message: string
}

export type FromWorker = ResultMessage | FailureMessage
