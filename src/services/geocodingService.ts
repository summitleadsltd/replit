const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const ORS_URL = 'https://api.openrouteservice.org';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
    });

    const response = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: { 'User-Agent': 'SummitScheduler/1.0' },
    });

    const data = await response.json();
    if (data.length === 0) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      display_name: data[0].display_name,
    };
  } catch {
    console.error('Geocoding failed');
    return null;
  }
}

export interface RouteResult {
  distance: number; // km
  duration: number; // minutes
}

export async function getRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<RouteResult | null> {
  const orsApiKey = import.meta.env.VITE_ORS_API_KEY;

  if (orsApiKey) {
    try {
      const response = await fetch(
        `${ORS_URL}/v2/directions/driving-car?start=${fromLng},${fromLat}&end=${toLng},${toLat}`,
        { headers: { Authorization: orsApiKey } },
      );
      const data = await response.json();
      const segment = data.features?.[0]?.properties?.segments?.[0];
      if (segment) {
        return {
          distance: segment.distance / 1000,
          duration: segment.duration / 60,
        };
      }
    } catch {
      // fallback to haversine
    }
  }

  // Fallback: Haversine distance with estimated drive time
  const distance = haversineDistance(fromLat, fromLng, toLat, toLng);
  return {
    distance,
    duration: (distance / 50) * 60, // Assume 50 km/h average speed
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
