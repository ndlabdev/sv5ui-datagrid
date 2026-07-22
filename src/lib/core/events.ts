export type EventHandler<TPayload> = (payload: TPayload) => void

export class EventBus<TMap> {
    #handlers = new Map<keyof TMap, Set<EventHandler<never>>>()

    /**
     * Dispatch runs over a snapshot, so a handler that subscribes or
     * unsubscribes mid-dispatch cannot change the round already in flight.
     * The snapshot is cached rather than rebuilt per emit: subscriptions
     * change once at setup, while a batched edit emits once per cell.
     */
    #dispatch = new Map<keyof TMap, EventHandler<never>[]>()

    on<K extends keyof TMap>(event: K, handler: EventHandler<TMap[K]>): () => void {
        let handlers = this.#handlers.get(event)
        if (!handlers) {
            handlers = new Set()
            this.#handlers.set(event, handlers)
        }
        handlers.add(handler as EventHandler<never>)
        this.#dispatch.delete(event)
        return () => this.off(event, handler)
    }

    off<K extends keyof TMap>(event: K, handler: EventHandler<TMap[K]>): void {
        if (this.#handlers.get(event)?.delete(handler as EventHandler<never>)) {
            this.#dispatch.delete(event)
        }
    }

    emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
        const handlers = this.#handlers.get(event)
        if (!handlers || handlers.size === 0) return

        let dispatch = this.#dispatch.get(event)
        if (!dispatch) {
            dispatch = [...handlers]
            this.#dispatch.set(event, dispatch)
        }
        for (const handler of dispatch) {
            ;(handler as EventHandler<TMap[K]>)(payload)
        }
    }
}
