const memCache = new Map<string, { data: any; expires: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const item = memCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    memCache.delete(key);
    return null;
  }
  return item.data as T;
}

export async function cacheSet(key: string, data: any, ttlSeconds: number): Promise<void> {
  memCache.set(key, {
    data,
    expires: Date.now() + ttlSeconds * 1000,
  });
}