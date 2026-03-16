import { db } from '@/lib/db/client';
import { pois, dataSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { PoiRecordSchema } from '@/lib/admin/schemas';
import { HttpJsonSourceAdapter } from './source-adapter';

export interface SyncResult {
  fetched: number;
  upserted: number;
  skipped: number;
}

export async function syncDataSource(sourceId: string): Promise<SyncResult> {
  const [source] = await db.select().from(dataSources).where(eq(dataSources.id, sourceId)).limit(1);
  if (!source) throw new Error('Data source not found');

  const adapter = new HttpJsonSourceAdapter();
  const raw = await adapter.fetchPois(source.sourceUrl);

  let upserted = 0;
  let skipped = 0;

  for (const record of raw) {
    const parsed = PoiRecordSchema.safeParse(record);
    if (!parsed.success) {
      skipped++;
      continue;
    }
    await db
      .insert(pois)
      .values({ ...parsed.data, sourceUrl: source.sourceUrl })
      .onConflictDoUpdate({
        target: pois.name,
        set: {
          description: parsed.data.description,
          address: parsed.data.address,
          openingHours: parsed.data.openingHours,
          updatedAt: new Date(),
        },
      });
    upserted++;
  }

  await db
    .update(dataSources)
    .set({ lastSyncedAt: new Date() })
    .where(eq(dataSources.id, sourceId));

  return { fetched: raw.length, upserted, skipped };
}
