export type EventHandler<TPayload> = (payload: TPayload) => void

export class EventBus<TMap> {
    #handlers = new Map<keyof TMap, Set<EventHandler<never>>>()

    on<K extends keyof TMap>(event: K, handler: EventHandler<TMap[K]>): () => void {
        let handlers = this.#handlers.get(event)
        if (!handlers) {
            handlers = new Set()
            this.#handlers.set(event, handlers)
        }
        handlers.add(handler as EventHandler<never>)
        return () => this.off(event, handler)
    }

    off<K extends keyof TMap>(event: K, handler: EventHandler<TMap[K]>): void {
        this.#handlers.get(event)?.delete(handler as EventHandler<never>)
    }

    emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
        const handlers = this.#handlers.get(event)
        if (!handlers) return
        for (const handler of [...handlers]) {
            ;(handler as EventHandler<TMap[K]>)(payload)
        }
    }
}
