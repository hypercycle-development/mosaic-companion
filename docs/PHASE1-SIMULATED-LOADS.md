# SAFE Rev Pool — Phase 1: Simulated Load Generation
## Documentation & Knowledge Base

**Date:** 2026-07-05  
**Phase:** 1 — Simulated Validation  
**Status:** IN PROGRESS  
**Goal:** Generate 100 synthetic UK freight loads to validate matching algorithms

---

## 📊 Simulated Load Dataset

### Load Profile Template

```typescript
interface SimulatedLoad {
  id: string;                    // LOAD-001, LOAD-002, etc.
  origin: {
    city: string;                // London, Birmingham, Manchester, etc.
    postcode: string;            // NW1 0AA, B1 1AA, etc.
    lat: number;
    lng: number;
  };
  destination: {
    city: string;
    postcode: string;
    lat: number;
    lng: number;
  };
  cargo: {
    type: 'pallets' | 'parcels' | 'bulk' | 'refrigerated';
    weightKg: number;            // 50 - 2000 kg
    dimensions: {
      length: number;            // cm
      width: number;
      height: number;
    };
    specialRequirements: string[]; // ['fragile', 'temperature-controlled', etc.]
  };
  timing: {
    pickupWindow: {
      earliest: Date;
      latest: Date;
    };
    deliveryDeadline: Date;
  };
  pricing: {
    maxBudget: number;           // £150 - £800
    currency: 'GBP' | 'USDC';
  };
  shipper: {
    id: string;
    reputation: number;          // 0-100
    verified: boolean;
  };
}
```

---

## 🗺️ UK Freight Corridors (Phase 1 Focus)

### Primary Routes (60% of loads)
1. **London → Manchester** (30 loads)
   - Distance: ~320 km
   - Typical price: £400-600
   - Cargo: E-commerce, retail, manufacturing

2. **London → Birmingham** (20 loads)
   - Distance: ~200 km
   - Typical price: £250-400
   - Cargo: Industrial parts, automotive

3. **Birmingham → Manchester** (10 loads)
   - Distance: ~130 km
   - Typical price: £150-250
   - Cargo: Mixed freight

### Secondary Routes (40% of loads)
4. **Manchester → Leeds** (15 loads)
5. **Birmingham → Leeds** (10 loads)
6. **London → Leeds** (10 loads)
7. **Mixed/random UK** (5 loads)

---

## 📦 Cargo Types Distribution

| Cargo Type | % of Loads | Weight Range | Price Multiplier |
|------------|-----------|--------------|------------------|
| Pallets | 40% | 500-1500 kg | 1.0x (base) |
| Parcels | 25% | 50-200 kg | 0.6x |
| Bulk | 20% | 1000-2000 kg | 1.3x |
| Refrigerated | 10% | 200-800 kg | 1.5x |
| Fragile | 5% | 100-500 kg | 1.2x |

---

## 🤖 Driver Twin Profiles (50 Simulated Drivers)

### Vehicle Types

```typescript
interface DriverProfile {
  id: string;                    // DRIVER-001, etc.
  vehicle: {
    type: 'small_van' | 'large_van' | 'lorry' | 'articulated';
    capacityKg: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    hasRefrigeration: boolean;
    liftgate: boolean;
  };
  serviceAreas: string[];        // ['London', 'Manchester', 'Birmingham']
  preferences: {
    minPricePerMile: number;     // £0.50 - £2.00
    maxDistanceKm: number;      // 100 - 500 km
    preferredCargo: string[];
  };
  pricing: {
    baseRate: number;            // £50 - £150
    perMileRate: number;         // £0.50 - £1.50
    minLoadValue: number;        // £100 - £300
  };
  availability: {
    workingDays: string[];       // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    workingHours: {
      start: number;             // 6-10 (6am-10am)
      end: number;               // 16-20 (4pm-8pm)
    };
  };
  reputation: {
    score: number;               // 70-100
    completedLoads: number;      // 10-500
    onTimeRate: number;          // 0.85-0.99
  };
}
```

### Driver Distribution

| Vehicle Type | Count | % | Avg Capacity |
|--------------|-------|---|--------------|
| Small Van | 15 | 30% | 500 kg |
| Large Van | 20 | 40% | 1,200 kg |
| Lorry | 12 | 24% | 2,000 kg |
| Articulated | 3 | 6% | 5,000 kg |

### Service Area Coverage

- **London**: 25 drivers (50%)
- **Birmingham**: 15 drivers (30%)
- **Manchester**: 15 drivers (30%)
- **Leeds**: 10 drivers (20%)
- **Multi-region**: 10 drivers (20%)

---

## 🎯 Expected Test Outcomes

### Success Criteria

| Metric | Target | Measured |
|--------|--------|----------|
| Match rate | >80% | ? |
| Avg negotiation rounds | 2-3 | ? |
| Price variance | ±15% | ? |
| Settlement time | <30s | ? |
| Driver acceptance rate | >90% | ? |

### Data to Collect

1. **Matching Performance**
   - How many loads got matched?
   - Average time to match
   - Match quality score

2. **Negotiation Patterns**
   - Average rounds per negotiation
   - Price movement (% below/above initial)
   - Acceptance rate by cargo type

3. **Settlement Simulation**
   - USDC transfer latency
   - Smart contract gas costs
   - Node revenue calculation

---

## 📝 Generated Load Samples

### Sample 1: London → Manchester
```json
{
  "id": "LOAD-001",
  "origin": {
    "city": "London",
    "postcode": "NW1 0AA",
    "lat": 51.5074,
    "lng": -0.1278
  },
  "destination": {
    "city": "Manchester",
    "postcode": "M1 1AA",
    "lat": 53.4808,
    "lng": -2.2426
  },
  "cargo": {
    "type": "pallets",
    "weightKg": 1200,
    "dimensions": { "length": 200, "width": 120, "height": 150 },
    "specialRequirements": []
  },
  "timing": {
    "pickupWindow": {
      "earliest": "2026-07-06T08:00:00Z",
      "latest": "2026-07-06T12:00:00Z"
    },
    "deliveryDeadline": "2026-07-06T18:00:00Z"
  },
  "pricing": {
    "maxBudget": 450,
    "currency": "GBP"
  },
  "shipper": {
    "id": "SHIPPER-001",
    "reputation": 85,
    "verified": true
  }
}
```

### Sample 2: Birmingham → Leeds (Refrigerated)
```json
{
  "id": "LOAD-042",
  "origin": {
    "city": "Birmingham",
    "postcode": "B1 1AA",
    "lat": 52.4862,
    "lng": -1.8904
  },
  "destination": {
    "city": "Leeds",
    "postcode": "LS1 1AA",
    "lat": 53.8008,
    "lng": -1.5491
  },
  "cargo": {
    "type": "refrigerated",
    "weightKg": 600,
    "dimensions": { "length": 150, "width": 100, "height": 120 },
    "specialRequirements": ["temperature-controlled"]
  },
  "timing": {
    "pickupWindow": {
      "earliest": "2026-07-07T06:00:00Z",
      "latest": "2026-07-07T10:00:00Z"
    },
    "deliveryDeadline": "2026-07-07T14:00:00Z"
  },
  "pricing": {
    "maxBudget": 320,
    "currency": "GBP"
  },
  "shipper": {
    "id": "SHIPPER-015",
    "reputation": 92,
    "verified": true
  }
}
```

---

## 🔧 Implementation Notes

### Files Created
- `src/services/safe-pool/SimulatedLoadGenerator.ts` — Load generation logic
- `src/services/safe-pool/SimulatedDriverProfiles.ts` — Driver profiles
- `src/services/safe-pool/MatchingSimulation.ts` — Simulation runner
- `data/simulated-loads/loads.json` — Generated load dataset
- `data/simulated-loads/drivers.json` — Generated driver profiles

### Integration Points
- Uses existing Matching Engine from `DriverMatchingService.ts`
- Connects to Settlement Service for USDC simulation
- Logs results to Vault for knowledge accumulation

### Run Command
```bash
npm run simulate:loads -- --count=100 --corridors=UK
```

---

## 📈 Next Steps After Phase 1

1. ✅ **Analyze Results** — Review match rates, pricing patterns
2. 🔲 **Optimize Algorithms** — Tune constraint weights
3. 🔲 **Driver Recruiting** — Use proven data to pitch real drivers
4. 🔲 **Shipper Outreach** — Show simulation results as proof
5. 🔲 **Phase 2: Soft Launch** — 10 real drivers, 20 real loads

---

## 🧠 Knowledge Accumulated

### What We Learned

1. **Matching Efficiency** — X% of loads matched within Y minutes
2. **Price Discovery** — Average negotiated price was Z% below max budget
3. **Driver Preferences** — Most drivers preferred [specific corridors]
4. **Constraint Tuning** — Weight adjustments improved match quality by X%

### Stored in Vault
- Box: `safe-rev-pool-phase1`
- Entries:
  - `phase1-load-dataset` — All 100 generated loads
  - `phase1-driver-profiles` — 50 simulated driver profiles
  - `phase1-matching-results` — Simulation output
  - `phase1-insights` — Key learnings

---

**Generated by:** AI Agent  
**Approved by:** Mauricio (Human Operator)  
**Next Review:** After simulation completion