/**
 * 惰性 thenable：仅在 then / catch / finally 被调用时才执行异步工作。
 * 多次订阅共享同一次执行。
 */

export interface LazyThenable<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult>;
  finally(onfinally?: (() => void) | null): Promise<T>;
}

export function lazyThenable<T>(execute: () => Promise<T>): LazyThenable<T> {
  let started: Promise<T> | undefined;
  const run = (): Promise<T> => {
    if (!started) {
      started = execute();
    }
    return started;
  };
  return {
    then(onfulfilled, onrejected) {
      return run().then(onfulfilled, onrejected);
    },
    catch(onrejected) {
      return run().catch(onrejected);
    },
    finally(onfinally) {
      return run().finally(onfinally);
    },
  };
}
