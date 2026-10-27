export const UA = { 'User-Agent': 'TavorSummary/1.0 (property summaries; contact amtecai.com)' }

export async function getJson<T = any>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...UA, ...init.headers }, signal: AbortSignal.timeout(init.timeoutMs ?? 60_000) })
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`)
  return res.json() as Promise<T>
}

export async function retry<T>(fn: (attempt: number) => Promise<T>, attempts = 4, baseMs = 2000): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i)
    } catch (err) {
      last = err
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseMs * 2 ** i))
    }
  }
  throw last
}
