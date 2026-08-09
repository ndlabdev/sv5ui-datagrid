import { untrack } from 'svelte'

/**
 * Wraps a writer so nothing it reads becomes a dependency of its caller.
 *
 * A setter reads to decide what to write, and grid state is replaced rather
 * than patched — some of it reaching the row pipeline. Called from an `$effect`
 * without this, the effect subscribes to what it just wrote and either undoes
 * the user's action or never settles. Every method that writes goes through
 * here.
 */
export function mutator<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
    return (...args: TArgs) => untrack(() => fn(...args))
}
