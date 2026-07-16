import { describe, expect, it, vi } from 'vitest'
import { EventBus } from './events.js'

interface TestEvents {
    ping: { value: number }
}

describe('EventBus', () => {
    it('delivers payloads to subscribed handlers', () => {
        const bus = new EventBus<TestEvents>()
        const handler = vi.fn()
        bus.on('ping', handler)

        bus.emit('ping', { value: 1 })
        expect(handler).toHaveBeenCalledExactlyOnceWith({ value: 1 })
    })

    it('stops delivering after off', () => {
        const bus = new EventBus<TestEvents>()
        const handler = vi.fn()
        bus.on('ping', handler)
        bus.off('ping', handler)

        bus.emit('ping', { value: 1 })
        expect(handler).not.toHaveBeenCalled()
    })

    it('returns an unsubscribe function from on', () => {
        const bus = new EventBus<TestEvents>()
        const handler = vi.fn()
        const unsubscribe = bus.on('ping', handler)
        unsubscribe()

        bus.emit('ping', { value: 1 })
        expect(handler).not.toHaveBeenCalled()
    })

    it('supports multiple handlers per event', () => {
        const bus = new EventBus<TestEvents>()
        const first = vi.fn()
        const second = vi.fn()
        bus.on('ping', first)
        bus.on('ping', second)

        bus.emit('ping', { value: 2 })
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)
    })
})
