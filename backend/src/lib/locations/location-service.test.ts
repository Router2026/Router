import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock rawDb and cache
vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}));
vi.mock('@/lib/cache/mem-cache', () => ({
  cacheGet: vi.fn().mockReturnValue(null),
  cacheSet: vi.fn(),
}));

import { rawDb } from '@/lib/db/raw-client';
import { cacheGet, cacheSet } from '@/lib/cache/mem-cache';
import {
  getLocations,
  getLocationById,
  getLocationsInBounds,
  upsertLocation,
} from './location-service';

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> };
const mockCacheGet = cacheGet as ReturnType<typeof vi.fn>;
const mockCacheSet = cacheSet as ReturnType<typeof vi.fn>;

const sampleRow = {
  id: 1,
  name: 'Ein Gedi',
  description: 'Nature reserve',
  category: 'טבע',
  region_id: 2,
  region_name: 'Dead Sea',
  latitude: '31.46',
  longitude: '35.39',
  images: '[]',
  main_image: null,
  source: 'manual',
  source_id: null,
  difficulty: 'בינוני',
  duration_minutes: 120,
  has_water: true,
  has_shade: true,
  accessible: false,
  average_rating: '4.8',
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCacheGet.mockReturnValue(null);
});

describe('getLocations', () => {
  it('returns locations from DB and caches result', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRow] });
    const result = await getLocations({});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ein Gedi');
    expect(result[0].latitude).toBe(31.46);
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('returns cached result without hitting DB', async () => {
    const cached = [{ ...sampleRow, id: 99 }];
    mockCacheGet.mockReturnValue(cached);
    const result = await getLocations({});
    expect(result).toBe(cached);
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('passes region filter to query', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await getLocations({ region: 'north' });
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(params).toContain('north');
    expect(sql).toContain('slug');
  });

  it('passes search filter to query', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await getLocations({ search: 'waterfall' });
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(params).toContain('%waterfall%');
    expect(sql).toContain('ILIKE');
  });
});

describe('getLocationById', () => {
  it('returns location when found', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRow] });
    const result = await getLocationById(1);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Ein Gedi');
  });

  it('returns null when not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    const result = await getLocationById(999);
    expect(result).toBeNull();
  });

  it('returns cached result without hitting DB', async () => {
    mockCacheGet.mockReturnValue(sampleRow);
    await getLocationById(1);
    expect(mockDb.query).not.toHaveBeenCalled();
  });
});

describe('getLocationsInBounds', () => {
  it('queries with bounds params', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await getLocationsInBounds({ north: 33, south: 31, east: 36, west: 34 });
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(params).toContain(34); // west
    expect(params).toContain(31); // south
    expect(sql).toContain('ST_Within');
  });
});

describe('upsertLocation', () => {
  it('calls insert with ON CONFLICT', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 10 }] });
    const id = await upsertLocation({
      name: 'New Place',
      latitude: 32.0,
      longitude: 35.0,
      source: 'manual',
    });
    expect(id).toBe(10);
    const [sql] = mockDb.query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT');
  });
});
