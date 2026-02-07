export const mergeIssues = (items: string[]) =>
  Array.from(new Set(items.filter(Boolean)));

export const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

export const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${timeoutMs / 1000}s timeout.`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

export const withAbort = async <T,>(promise: Promise<T>, signal?: AbortSignal) => {
  if (!signal) return promise;
  if (signal.aborted) {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    throw error;
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      const error = new Error("Operation aborted.");
      error.name = "AbortError";
      reject(error);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
};

export const withAbortAndTimeout = async <T,>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  label: string
) => withAbort(withTimeout(promise, timeoutMs, label), signal);
