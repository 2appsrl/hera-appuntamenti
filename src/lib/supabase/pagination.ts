// Supabase / PostgREST caps responses at ~1000 rows by default. For dashboards
// that need every matching row (breakdowns, charts, etc.), fetch in 1000-row
// pages until the source is exhausted.

const PAGE_SIZE = 1000

type PageQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
}

export async function fetchAllPaginated<T>(buildQuery: () => PageQuery<T>): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return all
}
