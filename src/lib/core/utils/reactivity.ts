import { untrack } from 'svelte'

export function mutator<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
    return (...args: TArgs) => untrack(() => fn(...args))
}
