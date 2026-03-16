import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { TripBucketProvider, useTripBucket } from './TripBucketContext';
import type { POI } from '../api';

const makePoi = (id: string): POI => ({
  id,
  name: `POI ${id}`,
  description: '',
  category: 'טבע',
  region: 'north',
  latitude: 32.0,
  longitude: 35.0,
  images: [],
  main_image: '',
  difficulty: 'בינוני',
  average_rating: 4.0,
});

function Harness({ fn }: { fn: (ctx: ReturnType<typeof useTripBucket>) => void }) {
  const ctx = useTripBucket();
  React.useEffect(() => {
    fn(ctx);
  }, []);
  return (
    <div>
      <div data-testid="count">{ctx.count}</div>
      <div data-testid="isSheetOpen">{String(ctx.isSheetOpen)}</div>
      <div data-testid="hasPoi1">{String(ctx.hasPoi('1'))}</div>
      <div data-testid="items">{ctx.items.map((i) => i.poi.id).join(',')}</div>
    </div>
  );
}

function wrap(fn: (ctx: ReturnType<typeof useTripBucket>) => void) {
  return render(
    <TripBucketProvider>
      <Harness fn={fn} />
    </TripBucketProvider>
  );
}

describe('TripBucketContext', () => {
  it('starts with 0 items and closed sheet', () => {
    const { getByTestId } = wrap(() => {});
    expect(getByTestId('count').textContent).toBe('0');
    expect(getByTestId('isSheetOpen').textContent).toBe('false');
  });

  it('addPoi adds an item and updates count', () => {
    let captured: ReturnType<typeof useTripBucket>;
    const { getByTestId } = wrap((ctx) => {
      captured = ctx;
    });

    act(() => {
      captured.addPoi(makePoi('1'));
    });
    expect(getByTestId('count').textContent).toBe('1');
    expect(getByTestId('hasPoi1').textContent).toBe('true');
  });

  it('addPoi ignores duplicates', () => {
    let captured: ReturnType<typeof useTripBucket>;
    const { getByTestId } = wrap((ctx) => {
      captured = ctx;
    });

    act(() => {
      captured.addPoi(makePoi('1'));
      captured.addPoi(makePoi('1'));
    });
    expect(getByTestId('count').textContent).toBe('1');
  });

  it('removePoi removes an item', () => {
    let captured: ReturnType<typeof useTripBucket>;
    const { getByTestId } = wrap((ctx) => {
      captured = ctx;
    });

    act(() => {
      captured.addPoi(makePoi('1'));
    });
    act(() => {
      captured.removePoi('1');
    });
    expect(getByTestId('count').textContent).toBe('0');
  });

  it('hasPoi returns false for unknown id', () => {
    let captured: ReturnType<typeof useTripBucket>;
    wrap((ctx) => {
      captured = ctx;
    });
    act(() => {});
    expect(captured!.hasPoi('nonexistent')).toBe(false);
  });

  it('clearBucket empties items', () => {
    let captured: ReturnType<typeof useTripBucket>;
    const { getByTestId } = wrap((ctx) => {
      captured = ctx;
    });

    act(() => {
      captured.addPoi(makePoi('1'));
      captured.addPoi(makePoi('2'));
    });
    act(() => {
      captured.clearBucket();
    });
    expect(getByTestId('count').textContent).toBe('0');
  });

  it('reorderItems changes order', () => {
    let captured: ReturnType<typeof useTripBucket>;
    const { getByTestId } = wrap((ctx) => {
      captured = ctx;
    });

    act(() => {
      captured.addPoi(makePoi('1'));
      captured.addPoi(makePoi('2'));
      captured.addPoi(makePoi('3'));
    });
    act(() => {
      captured.reorderItems(0, 2);
    });
    expect(getByTestId('items').textContent).toBe('2,3,1');
  });

  it('openSheet and closeSheet toggle isSheetOpen', () => {
    let captured: ReturnType<typeof useTripBucket>;
    const { getByTestId } = wrap((ctx) => {
      captured = ctx;
    });

    act(() => {
      captured.openSheet();
    });
    expect(getByTestId('isSheetOpen').textContent).toBe('true');
    act(() => {
      captured.closeSheet();
    });
    expect(getByTestId('isSheetOpen').textContent).toBe('false');
  });
});
