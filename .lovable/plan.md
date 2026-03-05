

## Plano: Correção de Exclusão + Suporte a Múltiplas Viagens Ativas + Dashboard Dinâmico

Este plano aborda três grandes áreas: (1) corrigir o odômetro ao excluir abastecimentos/viagens, (2) permitir múltiplas viagens ativas (uma por veículo), e (3) redesenhar o Dashboard com filtros de status e lista dinâmica de viagens.

---

### PARTE 1: Recálculo do Odômetro na Exclusão

**Arquivo: `src/context/AppContext.tsx`**

**`deleteFueling`** (linha 401-404) — Atualmente apenas deleta e chama `fetchData`. Precisa:
1. Antes de deletar, identificar o `trip_id` e `vehicle_id` do abastecimento
2. Após deletar, fazer query para encontrar o maior `km_current` restante nos abastecimentos daquele veículo (via join com trips)
3. Também buscar o maior KM em `freights.km_initial` para o mesmo veículo
4. Definir `current_km` do veículo como o `Math.max()` entre esses valores (ou o KM original do cadastro se nenhum existir)
5. Chamar `fetchData()`

**`deleteTrip`** (linha 306-309) — Mesma lógica:
1. Antes de deletar, pegar o `vehicle_id` da viagem
2. Após deletar (cascade deleta freights/fuelings/expenses), buscar o maior KM restante para o veículo
3. Atualizar `current_km` do veículo

Nova função auxiliar `recalculateVehicleKm(vehicleId: string)`:
```typescript
async function recalculateVehicleKm(vehicleId: string) {
  // Get max KM from all remaining fuelings for this vehicle
  const { data: vehicleTrips } = await supabase
    .from("trips").select("id").eq("vehicle_id", vehicleId);
  const tripIds = (vehicleTrips || []).map(t => t.id);
  
  if (tripIds.length === 0) {
    // No trips left, keep vehicle's original KM or reset
    return;
  }
  
  const { data: fuelings } = await supabase
    .from("fuelings").select("km_current")
    .in("trip_id", tripIds)
    .order("km_current", { ascending: false }).limit(1);
  
  const { data: freights } = await supabase
    .from("freights").select("km_initial")
    .in("trip_id", tripIds)
    .order("km_initial", { ascending: false }).limit(1);
  
  const maxFuelingKm = fuelings?.[0]?.km_current || 0;
  const maxFreightKm = freights?.[0]?.km_initial || 0;
  const maxKm = Math.max(maxFuelingKm, maxFreightKm);
  
  await supabase.from("vehicles").update({ current_km: maxKm }).eq("id", vehicleId);
}
```

---

### PARTE 2: Múltiplas Viagens Ativas (Uma por Veículo)

**Arquivo: `src/context/AppContext.tsx`**

- **`getActiveTrip`** (linha 311): Mudar de retornar UMA viagem para retornar TODAS as viagens ativas. Renomear para `getActiveTrips` retornando `Trip[]`.
- **`addTrip`** (linha 272): Remover trava global de "1 viagem ativa". Adicionar validação: verificar se já existe viagem `open` para o `vehicleId` selecionado. Se sim, lançar erro.
- **Interface `AppContextType`**: Atualizar `getActiveTrip` → `getActiveTrips(): Trip[]`

**Arquivo: `src/context/AppContext.tsx` — interface update**:
```typescript
getActiveTrips: () => Trip[];
```

---

### PARTE 3: Dashboard Dinâmico

**Arquivo: `src/pages/Dashboard.tsx`**

1. **Novo estado**: `statusFilter` com valores `"all" | "open" | "finished"`, default `"all"`
2. **Novo UI**: Segmented control abaixo do filtro de veículos com 3 botões: `[Todas] [Em Andamento] [Finalizadas]`
3. **Filtro combinado**: Os `filteredTrips` agora passam por 3 filtros em cascata: veículo → status → período
4. **Summary Cards**: Reativos aos filtros combinados (já funciona se `filteredTrips` estiver correto)
5. **Lista de viagens**: Substituir a seção `activeTrip` + `TripHistoryList` por uma lista unificada:
   - Status `"all"`: Viagens ativas no topo + finalizadas abaixo
   - Status `"open"`: Apenas viagens ativas (pode haver múltiplas)
   - Status `"finished"`: Apenas finalizadas
6. **Botão "Nova Viagem"**: Sempre visível (não mais condicionado a `!activeTrip`). A validação de veículo ocupado vai para a NewTripPage.
7. **Cada card de viagem**: Mostrar placa/nome do veículo em destaque

---

### PARTE 4: NewTripPage — Veículos Ocupados

**Arquivo: `src/pages/NewTripPage.tsx`**

1. Identificar quais veículos têm viagem `open` usando `data.trips.filter(t => t.status === "open")`
2. Para cada veículo na lista:
   - **Livre**: Renderizar normalmente, clicável
   - **Ocupado**: Renderizar com `opacity-50`, não-clicável, com badge `[EM VIAGEM]` (fundo laranja/vermelho claro)
3. Se um veículo específico está filtrado no Dashboard (passar via query param ou state), pré-selecionar
4. Impedir `handleCreate` se o veículo selecionado já estiver em viagem

Usar `useLocation` para receber `state.preSelectedVehicleId` do Dashboard.

---

### PARTE 5: ActiveTripCard — Suporte a Múltiplos

**Arquivo: `src/components/ActiveTripCard.tsx`**

- Sem mudanças estruturais no componente; ele já recebe uma `trip` individual
- Será chamado em loop no Dashboard para cada viagem ativa

---

### Resumo de Arquivos

| Arquivo | Mudanças |
|---------|----------|
| `src/context/AppContext.tsx` | `recalculateVehicleKm` helper; reescrever `deleteFueling`, `deleteTrip`; `getActiveTrip` → `getActiveTrips`; remover trava de 1 viagem ativa global, adicionar trava por veículo |
| `src/pages/Dashboard.tsx` | Filtro de status (segmented control); lista unificada de viagens; summary cards reativos; botão "Nova Viagem" sempre visível com navegação passando veículo filtrado |
| `src/pages/NewTripPage.tsx` | Badge `[EM VIAGEM]` em veículos ocupados; disable veículos com viagem ativa; pré-seleção via state |
| `src/components/ActiveTripCard.tsx` | Adicionar placa do veículo em destaque no card |
| `src/components/TripHistoryList.tsx` | Adicionar placa do veículo em cada item da lista |

