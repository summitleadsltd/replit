interface DistanceMatrixResponse {
  status: string;
  rows: Array<{
    elements: Array<{
      status: string;
      duration: {
        value: number; // seconds
        text: string;
      };
      distance: {
        value: number; // meters
        text: string;
      };
    }>;
  }>;
}

interface RouteOptimizationResult {
  origin: string;
  destinations: Array<{
    address: string;
    duration: number; // seconds
    distance: number; // meters
    optimizedOrder: number;
  }>;
  totalDuration: number;
  totalDistance: number;
}

/**
 * Calculate travel time between two addresses using Google Distance Matrix API
 */
export async function getTravelTime(
  origin: string,
  destination: string
): Promise<{ duration: number; distance: number } | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn("Google Maps API key not configured");
    return null;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;
    const response = await fetch(url);
    const data: DistanceMatrixResponse = await response.json();

    if (data.status === "OK" && data.rows[0]?.elements[0]?.status === "OK") {
      const element = data.rows[0].elements[0];
      return {
        duration: element.duration.value,
        distance: element.distance.value,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching travel time:", error);
    return null;
  }
}

/**
 * Calculate travel times from one origin to multiple destinations
 */
export async function getTravelTimes(
  origin: string,
  destinations: string[]
): Promise<Array<{ address: string; duration: number; distance: number }>> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn("Google Maps API key not configured");
    return destinations.map(addr => ({ address: addr, duration: 0, distance: 0 }));
  }

  try {
    const destinationsStr = destinations.map(d => encodeURIComponent(d)).join("|");
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${destinationsStr}&key=${apiKey}`;
    const response = await fetch(url);
    const data: DistanceMatrixResponse = await response.json();

    if (data.status === "OK") {
      return destinations.map((dest, index) => {
        const element = data.rows[0]?.elements[index];
        if (element?.status === "OK") {
          return {
            address: dest,
            duration: element.duration.value,
            distance: element.distance.value,
          };
        }
        return { address: dest, duration: 0, distance: 0 };
      });
    }

    return destinations.map(addr => ({ address: addr, duration: 0, distance: 0 }));
  } catch (error) {
    console.error("Error fetching travel times:", error);
    return destinations.map(addr => ({ address: addr, duration: 0, distance: 0 }));
  }
}

/**
 * Optimize route order using nearest neighbor algorithm
 */
export function optimizeRoute(
  startAddress: string,
  destinations: Array<{ address: string; duration: number; distance: number }>
): RouteOptimizationResult {
  if (destinations.length === 0) {
    return {
      origin: startAddress,
      destinations: [],
      totalDuration: 0,
      totalDistance: 0,
    };
  }

  // Simple nearest neighbor algorithm
  const unvisited = [...destinations];
  const optimized: Array<{ address: string; duration: number; distance: number; optimizedOrder: number }> = [];
  let currentAddress = startAddress;
  let totalDuration = 0;
  let totalDistance = 0;

  while (unvisited.length > 0) {
    // Find nearest unvisited destination
    let nearestIndex = 0;
    let nearestDuration = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      if (unvisited[i].duration < nearestDuration) {
        nearestDuration = unvisited[i].duration;
        nearestIndex = i;
      }
    }

    const nearest = unvisited.splice(nearestIndex, 1)[0];
    optimized.push({
      ...nearest,
      optimizedOrder: optimized.length,
    });

    totalDuration += nearest.duration;
    totalDistance += nearest.distance;
    currentAddress = nearest.address;
  }

  return {
    origin: startAddress,
    destinations: optimized,
    totalDuration,
    totalDistance,
  };
}

/**
 * Calculate optimal route for a technician's daily appointments
 */
export async function optimizeTechnicianRoute(
  technicianHomeAddress: string,
  appointmentAddresses: string[]
): Promise<RouteOptimizationResult> {
  // Get travel times from home to all appointments
  const travelTimes = await getTravelTimes(technicianHomeAddress, appointmentAddresses);
  
  // Optimize the route
  return optimizeRoute(technicianHomeAddress, travelTimes);
}
