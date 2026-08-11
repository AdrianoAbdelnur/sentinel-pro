export type CatalogApiResult<T> = Partial<T> & { error?: string };

export async function requestCatalogApi<T = Record<string, unknown>>(path: string, options: RequestInit): Promise<CatalogApiResult<T>> {
  try {
    const response = await fetch(path, { ...options, headers: { "content-type": "application/json" } });
    const payload = (await response.json().catch(() => undefined)) as CatalogApiResult<T> | undefined;
    if (!response.ok) return { ...payload, error: payload?.error ?? `La solicitud falló (${response.status}).` } as CatalogApiResult<T>;
    return payload ?? ({} as CatalogApiResult<T>);
  } catch {
    return { error: "No pudimos completar la solicitud." } as CatalogApiResult<T>;
  }
}
