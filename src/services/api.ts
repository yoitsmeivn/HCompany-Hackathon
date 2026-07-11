// Mock transport boundary for the frontend.
// When the Node/Express backend lands, replace `resolve(...)` calls in the
// service modules with `fetch(`${API_BASE}/...`).then((r) => r.json())`
// (and add Zod parsing here if runtime validation is wanted).
export function resolve<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}
