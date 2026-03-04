

## Fix `getTripTotalKm` in `src/lib/calculations.ts`

**Problem**: The function uses `trip.freights[0]?.kmInitial` as the start point, which fails when freights is empty or when the freight's kmInitial isn't the true minimum.

**Change**: Replace lines 24-28 with the robust logic specified:

```typescript
export function getTripTotalKm(trip: Trip): number {
  if (trip.fuelings.length === 0) return 0;
  const fuelingKms = trip.fuelings.map(f => f.kmCurrent);
  const freightKms = trip.freights.map(f => f.kmInitial).filter(k => k > 0);
  const allStartKms = [...fuelingKms.slice(0, 1), ...freightKms];
  const startKm = allStartKms.length > 0 ? Math.min(...allStartKms) : 0;
  const endKm = Math.max(...fuelingKms);
  const total = endKm - startKm;
  return total > 0 ? total : 0;
}
```

**Scope**: Only `src/lib/calculations.ts`, only the `getTripTotalKm` function. No other files or functions touched.

