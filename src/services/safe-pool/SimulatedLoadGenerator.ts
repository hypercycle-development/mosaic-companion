/**
 * SAFE Rev Pool — Simulated Load Generator
 * Phase 1: Generate 100 synthetic UK freight loads for algorithm validation
 * 
 * This module creates realistic load data to test the matching engine
 * without requiring real drivers or shippers.
 */

export interface SimulatedLoad {
  id: string;
  origin: {
    city: string;
    postcode: string;
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
    type: 'pallets' | 'parcels' | 'bulk' | 'refrigerated' | 'fragile';
    weightKg: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    specialRequirements: string[];
  };
  timing: {
    pickupWindow: {
      earliest: Date;
      latest: Date;
    };
    deliveryDeadline: Date;
  };
  pricing: {
    maxBudget: number;
    currency: 'GBP' | 'USDC';
  };
  shipper: {
    id: string;
    reputation: number;
    verified: boolean;
  };
}

// UK Freight Corridors
const CORRIDORS = [
  { from: 'London', to: 'Manchester', distance: 320, volume: 30 },
  { from: 'London', to: 'Birmingham', distance: 200, volume: 20 },
  { from: 'Birmingham', to: 'Manchester', distance: 130, volume: 10 },
  { from: 'Manchester', to: 'Leeds', distance: 80, volume: 15 },
  { from: 'Birmingham', to: 'Leeds', distance: 180, volume: 10 },
  { from: 'London', to: 'Leeds', distance: 320, volume: 10 },
  { from: 'Bristol', to: 'London', distance: 190, volume: 5 },
];

// City coordinates
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'London': { lat: 51.5074, lng: -0.1278 },
  'Manchester': { lat: 53.4808, lng: -2.2426 },
  'Birmingham': { lat: 52.4862, lng: -1.8904 },
  'Leeds': { lat: 53.8008, lng: -1.5491 },
  'Bristol': { lat: 51.4545, lng: -2.5879 },
};

// Postcode prefixes by city
const POSTCODES: Record<string, string[]> = {
  'London': ['NW1', 'SW1', 'EC1', 'WC1', 'E1', 'SE1', 'N1', 'W1'],
  'Manchester': ['M1', 'M2', 'M3', 'M4', 'M15', 'M20'],
  'Birmingham': ['B1', 'B2', 'B3', 'B15', 'B29', 'B75'],
  'Leeds': ['LS1', 'LS2', 'LS6', 'LS10', 'LS15'],
  'Bristol': ['BS1', 'BS2', 'BS3', 'BS8', 'BS16'],
};

// Cargo types with weights and price multipliers
const CARGO_TYPES = [
  { type: 'pallets', weightMin: 500, weightMax: 1500, priceMultiplier: 1.0, probability: 0.40 },
  { type: 'parcels', weightMin: 50, weightMax: 200, priceMultiplier: 0.6, probability: 0.25 },
  { type: 'bulk', weightMin: 1000, weightMax: 2000, priceMultiplier: 1.3, probability: 0.20 },
  { type: 'refrigerated', weightMin: 200, weightMax: 800, priceMultiplier: 1.5, probability: 0.10 },
  { type: 'fragile', weightMin: 100, weightMax: 500, priceMultiplier: 1.2, probability: 0.05 },
] as const;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function selectCargoType(): typeof CARGO_TYPES[number] {
  const rand = Math.random();
  let cumulative = 0;
  for (const cargo of CARGO_TYPES) {
    cumulative += cargo.probability;
    if (rand <= cumulative) return cargo;
  }
  return CARGO_TYPES[0];
}

function generatePostcode(city: string): string {
  const prefixes = POSTCODES[city] || ['XX'];
  const prefix = prefixes[randomInt(0, prefixes.length - 1)];
  const suffix = `${randomInt(0, 9)}${String.fromCharCode(65 + randomInt(0, 25))}${String.fromCharCode(65 + randomInt(0, 25))}`;
  return `${prefix} ${suffix}`;
}

function calculatePrice(distance: number, cargoType: typeof CARGO_TYPES[number]): number {
  // Base rate: £0.50-£1.50 per mile, converted to km
  const ratePerKm = randomFloat(0.30, 0.93);
  const basePrice = distance * ratePerKm;
  const adjustedPrice = basePrice * cargoType.priceMultiplier;
  // Round to nearest £10
  return Math.ceil(adjustedPrice / 10) * 10;
}

export function generateSimulatedLoads(count: number = 100): SimulatedLoad[] {
  const loads: SimulatedLoad[] = [];
  let loadId = 1;

  for (const corridor of CORRIDORS) {
    const loadsForCorridor = Math.round((corridor.volume / 100) * count);
    
    for (let i = 0; i < loadsForCorridor && loadId <= count; i++) {
      const cargo = selectCargoType();
      const price = calculatePrice(corridor.distance, cargo);
      
      // Generate pickup window (next 1-7 days)
      const now = new Date();
      const pickupDays = randomInt(1, 7);
      const pickupDate = new Date(now);
      pickupDate.setDate(pickupDate.getDate() + pickupDays);
      pickupDate.setHours(randomInt(6, 10), 0, 0, 0);
      
      const pickupLatest = new Date(pickupDate);
      pickupLatest.setHours(pickupDate.getHours() + randomInt(2, 6));
      
      // Delivery deadline (4-12 hours after pickup)
      const deliveryDeadline = new Date(pickupDate);
      deliveryDeadline.setHours(deliveryDeadline.getHours() + randomInt(4, 12));
      
      loads.push({
        id: `LOAD-${String(loadId).padStart(3, '0')}`,
        origin: {
          city: corridor.from,
          postcode: generatePostcode(corridor.from),
          lat: CITY_COORDS[corridor.from].lat + randomFloat(-0.05, 0.05),
          lng: CITY_COORDS[corridor.from].lng + randomFloat(-0.05, 0.05),
        },
        destination: {
          city: corridor.to,
          postcode: generatePostcode(corridor.to),
          lat: CITY_COORDS[corridor.to].lat + randomFloat(-0.05, 0.05),
          lng: CITY_COORDS[corridor.to].lng + randomFloat(-0.05, 0.05),
        },
        cargo: {
          type: cargo.type,
          weightKg: randomInt(cargo.weightMin, cargo.weightMax),
          dimensions: {
            length: randomInt(100, 250),
            width: randomInt(80, 150),
            height: randomInt(80, 200),
          },
          specialRequirements: cargo.type === 'refrigerated' ? ['temperature-controlled'] : 
                                cargo.type === 'fragile' ? ['fragile', 'handle-with-care'] : [],
        },
        timing: {
          pickupWindow: {
            earliest: pickupDate,
            latest: pickupLatest,
          },
          deliveryDeadline,
        },
        pricing: {
          maxBudget: price,
          currency: Math.random() > 0.3 ? 'USDC' : 'GBP',
        },
        shipper: {
          id: `SHIPPER-${String(randomInt(1, 20)).padStart(3, '0')}`,
          reputation: randomInt(70, 100),
          verified: Math.random() > 0.2,
        },
      });
      
      loadId++;
    }
  }

  return loads.slice(0, count);
}

// Generate driver profiles
export interface SimulatedDriver {
  id: string;
  name: string;
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
  serviceAreas: string[];
  pricing: {
    baseRate: number;
    perKmRate: number;
    minLoadValue: number;
  };
  availability: {
    workingDays: string[];
    workingHours: {
      start: number;
      end: number;
    };
  };
  reputation: {
    score: number;
    completedLoads: number;
    onTimeRate: number;
  };
}

const DRIVER_NAMES = [
  'John Smith', 'Sarah Jones', 'Mike Brown', 'Emma Wilson', 'David Lee',
  'Lisa Taylor', 'Chris Martin', 'Anna White', 'Mark Davis', 'Laura Hall',
  'James Clark', 'Kate Lewis', 'Alex Walker', 'Zoe Young', 'Ryan King',
  'Sophie Wright', 'Ben Green', 'Amy Adams', 'Daniel Baker', 'Olivia Harris',
];

const VEHICLE_TYPES = [
  { type: 'small_van', capacity: 500, prob: 0.30 },
  { type: 'large_van', capacity: 1200, prob: 0.40 },
  { type: 'lorry', capacity: 2000, prob: 0.24 },
  { type: 'articulated', capacity: 5000, prob: 0.06 },
] as const;

const UK_CITIES = ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol'];

export function generateSimulatedDrivers(count: number = 50): SimulatedDriver[] {
  const drivers: SimulatedDriver[] = [];
  
  for (let i = 0; i < count; i++) {
    const vehicleType = (() => {
      const rand = Math.random();
      let cum = 0;
      for (const v of VEHICLE_TYPES) {
        cum += v.prob;
        if (rand <= cum) return v;
      }
      return VEHICLE_TYPES[1];
    })();
    
    // Service areas: 1-3 cities
    const numCities = randomInt(1, 3);
    const shuffled = [...UK_CITIES].sort(() => Math.random() - 0.5);
    const serviceAreas = shuffled.slice(0, numCities);
    
    drivers.push({
      id: `DRIVER-${String(i + 1).padStart(3, '0')}`,
      name: DRIVER_NAMES[i % DRIVER_NAMES.length],
      vehicle: {
        type: vehicleType.type as SimulatedDriver['vehicle']['type'],
        capacityKg: vehicleType.capacity,
        dimensions: {
          length: randomInt(250, 600),
          width: randomInt(150, 250),
          height: randomInt(150, 300),
        },
        hasRefrigeration: Math.random() > 0.8,
        liftgate: vehicleType.type !== 'small_van' && Math.random() > 0.5,
      },
      serviceAreas,
      pricing: {
        baseRate: randomFloat(50, 150),
        perKmRate: randomFloat(0.50, 1.50),
        minLoadValue: randomFloat(100, 300),
      },
      availability: {
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].slice(0, randomInt(3, 5)),
        workingHours: {
          start: randomInt(6, 10),
          end: randomInt(16, 20),
        },
      },
      reputation: {
        score: randomInt(70, 100),
        completedLoads: randomInt(10, 500),
        onTimeRate: randomFloat(0.85, 0.99),
      },
    });
  }
  
  return drivers;
}

// Export for use in simulation
export const SimulationData = {
  generateLoads: generateSimulatedLoads,
  generateDrivers: generateSimulatedDrivers,
};

export default SimulationData;