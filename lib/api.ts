export type FetchOptions = RequestInit & { timeoutMs?: number };

export const fetchJson = async <T>(url: string, options: FetchOptions = {}): Promise<T> => {
  const { timeoutMs = 15000, ...rest } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(rest.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request failed (${res.status}): ${text}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
