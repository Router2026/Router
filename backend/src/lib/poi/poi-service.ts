import { db } from '@/lib/db/client';
import { pois } from '@/lib/db/schema';
import { eq, inArray, and, or, isNull } from 'drizzle-orm';
import type { Poi } from '@/lib/db/schema';

export async function getRelevantPois(
  categories: string[],
  areas: string[],
  subAreas: string[] = []
): Promise<Poi[]> {
  const validCategories = categories as Array<
    'restaurant' | 'coffee_trail' | 'hiking_trail' | 'attraction' | 'campsite'
  >;

  const regionFilter = inArray(pois.region, areas);
  const subAreaFilter = subAreas.length > 0 ? inArray(pois.subRegion, subAreas) : undefined;

  return db
    .select()
    .from(pois)
    .where(
      and(
        inArray(pois.category, validCategories),
        regionFilter,
        eq(pois.isActive, true),
        subAreaFilter ? or(subAreaFilter, isNull(pois.subRegion)) : undefined
      )
    )
    .limit(80);
}

export async function getAllPois(): Promise<Poi[]> {
  return db.select().from(pois).where(eq(pois.isActive, true));
}
