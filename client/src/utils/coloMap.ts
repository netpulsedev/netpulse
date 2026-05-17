// Maps Cloudflare colo codes to human-readable city names.
// These are the most common Cloudflare edge locations. You don't need
// every single one — unknown colos just show the raw code, which is still useful.

const COLO_MAP: Record<string, string> = {
  AMS: 'Amsterdam', ATL: 'Atlanta', BOM: 'Mumbai', BOS: 'Boston',
  CDG: 'Paris', CPH: 'Copenhagen', DEN: 'Denver', DFW: 'Dallas',
  DOH: 'Doha', DUB: 'Dublin', DUS: 'Düsseldorf', EWR: 'Newark',
  FRA: 'Frankfurt', GRU: 'São Paulo', HKG: 'Hong Kong', IAD: 'Ashburn',
  ICN: 'Seoul', JNB: 'Johannesburg', KIX: 'Osaka', LAX: 'Los Angeles',
  LHR: 'London', LIS: 'Lisbon', MAA: 'Chennai', MAD: 'Madrid',
  MAN: 'Manchester', MIA: 'Miami', MRS: 'Marseille', MXP: 'Milan',
  NRT: 'Tokyo', ORD: 'Chicago', PDX: 'Portland', SEA: 'Seattle',
  SFO: 'San Francisco', SIN: 'Singapore', SJC: 'San Jose', SYD: 'Sydney',
  TPE: 'Taipei', VIE: 'Vienna', WAW: 'Warsaw', YUL: 'Montréal',
  YYZ: 'Toronto', ZRH: 'Zürich', BLR: 'Bangalore', DEL: 'New Delhi',
  HYD: 'Hyderabad', CCU: 'Kolkata', MEL: 'Melbourne', PER: 'Perth',
  AKL: 'Auckland', CGK: 'Jakarta', KUL: 'Kuala Lumpur', BKK: 'Bangkok',
  JED: 'Jeddah', RUH: 'Riyadh', CAI: 'Cairo', LOS: 'Lagos',
  NBO: 'Nairobi', MNL: 'Manila', HAN: 'Hanoi', SGN: 'Ho Chi Minh City',
};

// Get the city name for a colo code, or return the code itself if unknown.
export function getColoCity(colo: string): string {
  return COLO_MAP[colo.toUpperCase()] ?? colo;
}
