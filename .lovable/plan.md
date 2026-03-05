- Plano: Corrigir Média de Consumo e Renomear "Rota Prevista"

### Problema Central

A função `calculateFuelingAverage` (AppContext.tsx, linha 44-66) usa `freights[0].kmInitial` como fallback quando não encontra abastecimento anterior com tanque cheio. Isso faz com que o "Tanque Inicial" (abastecimento no KM inicial) tenha sua litragem somada ao cálculo, gerando médias absurdas (ex: 700km / 341L = 2.05 km/l em vez de 700km / 130L = 5.38 km/l).

### Arquivos Alterados

**1. `src/context/AppContext.tsx**` — Reescrever `calculateFuelingAverage`

A lógica atual percorre abastecimentos anteriores somando litros até encontrar um `fullTank`. Se não encontra, usa `freights[0].kmInitial` como ponto de partida — incluindo os litros do tanque inicial no divisor.

Nova lógica:

- Detectar se o abastecimento atual é o primeiro da viagem (índice 0) ou se está no mesmo KM do primeiro frete
- **Se for o primeiro abastecimento (Tanque Inicial)**: Buscar o último abastecimento com `full_tank = true` do mesmo veículo em viagens anteriores via query ao banco (`fuelings` JOIN `trips` WHERE `vehicle_id` e `full_tank = true`, ordenado por `km_current DESC`, limit 1)
  - **Cenário A (tem histórico)**: calcular `(kmAtual - kmHistórico) / litrosAtuais`, marcar com flag `fromHistory = true`
  - **Cenário B (sem histórico)**: retornar `average = 0` e marcar com flag `isMarcoZero = true`
- **Se NÃO for o primeiro**: manter a lógica existente de percorrer abastecimentos anteriores, MAS excluir da soma de litros qualquer abastecimento que esteja no KM inicial (tanque inicial)
- A função `addFueling` precisa se tornar `async` para a query histórica — ela já é async
- Adicionar dois campos opcionais ao tipo `Fueling`: `fromHistory?: boolean` e `isMarcoZero?: boolean` (apenas no tipo local, não no banco — serão computados na exibição)

Na prática, como o banco não terá esses flags, a detecção será feita na UI.

**Simplificação**: Em vez de adicionar colunas ao banco, a detecção de "tanque inicial" e "marco zero" será feita no display (TripDetailPage) e no cálculo (calculateFuelingAverage).

Mudanças em `calculateFuelingAverage`:

```typescript
async function calculateFuelingAverage(
  fuelings: Fueling[],
  freights: Freight[],
  fueling: { kmCurrent: number; liters: number; fullTank: boolean },
  fuelingIndex: number,
  tripVehicleId?: string
): Promise<number> {
  if (!fueling.fullTank || fueling.liters === 0) return 0;
  
  // Determine the trip's starting KM
  const freightKms = freights.map(f => f.kmInitial).filter(k => k > 0);
  const firstFuelingKm = fuelings.length > 0 ? fuelings[0].kmCurrent : fueling.kmCurrent;
  const tripStartKm = freightKms.length > 0 ? Math.min(...freightKms, firstFuelingKm) : firstFuelingKm;
  const isInitialFueling = fuelingIndex === 0 || fueling.kmCurrent === tripStartKm;
  
  if (isInitialFueling) {
    // Historical lookup: find last full_tank fueling for this vehicle
    if (tripVehicleId) {
      const { data: lastFueling } = await supabase
        .from("fuelings")
        .select("km_current, id")
        .eq("full_tank", true)
        .order("km_current", { ascending: false })
        .limit(10); // get recent ones, filter by vehicle via trips
      // More precise: join through trips to filter by vehicle
      // Use a raw query approach or filter in JS
      const { data: vehicleFuelings } = await supabase
        .from("fuelings")
        .select("km_current, trip_id")
        .eq("full_tank", true)
        .order("km_current", { ascending: false });
      const { data: vehicleTrips } = await supabase
        .from("trips")
        .select("id")
        .eq("vehicle_id", tripVehicleId);
      const vehicleTripIds = new Set((vehicleTrips || []).map(t => t.id));
      const historicFueling = (vehicleFuelings || [])
        .filter(f => vehicleTripIds.has(f.trip_id) && f.km_current < fueling.kmCurrent)
        .sort((a, b) => b.km_current - a.km_current)[0];
      
      if (historicFueling) {
        const distance = fueling.kmCurrent - historicFueling.km_current;
        if (distance > 0) return Math.round((distance / fueling.liters) * 100) / 100;
      }
    }
    return 0; // Marco Zero
  }
  
  // Normal calculation — exclude initial fueling liters
  let lastFullTankKm: number | null = null;
  let accumLiters = 0;
  for (let i = fuelingIndex - 1; i >= 0; i--) {
    const isThisInitial = fuelings[i].kmCurrent === tripStartKm;
    if (!isThisInitial) accumLiters += fuelings[i].liters;
    if (fuelings[i].fullTank) { lastFullTankKm = fuelings[i].kmCurrent; break; }
  }
  if (lastFullTankKm === null) return 0;
  const totalLiters = accumLiters + fueling.liters;
  const distance = fueling.kmCurrent - lastFullTankKm;
  if (totalLiters === 0 || distance <= 0) return 0;
  return Math.round((distance / totalLiters) * 100) / 100;
}
```

Update `addFueling` and `updateFueling` to pass `trip.vehicleId` to the function and `await` it.

**2. `src/pages/TripDetailPage.tsx**` — UI changes

- Rename "Rota Prevista" → "KM Total da Viagem"
- In the fueling list, enhance "Tanque Inicial" display:
  - If `f.average > 0` and it's the initial fueling: show average with ℹ️ icon and tooltip "Média calculada com base no último abastecimento da viagem anterior"
  - If `f.average === 0` and it's the initial fueling: show "Marco Zero" tag with subtitle "A média será calculada no próximo abastecimento"

**3. `src/lib/calculations.ts**` — `getTripAverageConsumption`

- Exclude initial fueling from average calculation (fueling at trip start KM should not contribute its average to the trip's overall average if it was calculated from history)
- Actually, if the average stored in DB is correct (calculated properly), this function just averages them and should work fine. The fix in `calculateFuelingAverage` ensures correct values are stored.

### Scope Summary


| File                           | Change                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `src/context/AppContext.tsx`   | Rewrite `calculateFuelingAverage` to exclude initial fueling liters; add historical lookup for first fueling |
| `src/pages/TripDetailPage.tsx` | Rename "Rota Prevista" → "KM Total da Viagem"; add Marco Zero / historical average UI                        |
| `src/lib/calculations.ts`      | No changes needed (average calc uses stored values which will now be correct)                                |


### What stays untouched

- Switch "Completou o tanque" logic — unchanged
- Partial tank accumulation logic — unchanged  
- Financial totals (R$ of ALL fuelings always counted in expenses) — unchanged
- `getEffectiveKm`, `getTripCostPerKm`, `getTripProfitPerKm` — unchanged