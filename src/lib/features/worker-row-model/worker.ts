import { createEngine } from './engine.js'
import type { ToWorker } from './protocol.js'

const engine = createEngine()

self.onmessage = (event: MessageEvent<ToWorker>) => {
    const answer = engine(event.data)
    if (answer) self.postMessage(answer)
}
