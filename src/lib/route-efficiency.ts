import { getTravelTimes, optimizeRoute } from "./google-maps";

interface RouteSegment {
  address: string;
  duration: number; // seconds
  distance: number; // meters
  jobDuration: number; // minutes
  arrivalTime: Date;
  departureTime: Date;
}

interface RouteEfficiencyMetrics {
  jobDensity: number;
  travelTime: number;
  travelDistance: number;
  idleTime: number;
  totalRouteTime: number;
  totalJobTime: number;
  totalTravelTime: number;
  efficiencyScore: number;
  rating: "Excellent" | "Good" | "Fair" | "Poor";
}

interface RouteAnalysis {
  segments: RouteSegment[];
  metrics: RouteEfficiencyMetrics;
  recommendations: string[];
}

/**
 * Calculate route efficiency score based on:
 * - Job Density (jobs per hour)
 * - Travel Time (total travel time)
 * - Travel Distance (total distance)
 * - Idle Time (time between jobs)
 */
export async function calculateRouteEfficiency(
  technicianHomeAddress: string,
  appointments: Array<{
    address: string;
    duration: number; // minutes
    startTime: Date;
  }>
): Promise<RouteAnalysis> {
  if (appointments.length === 0) {
    return {
      segments: [],
      metrics: {
        jobDensity: 0,
        travelTime: 0,
        travelDistance: 0,
        idleTime: 0,
        totalRouteTime: 0,
        totalJobTime: 0,
        totalTravelTime: 0,
        efficiencyScore: 0,
        rating: "Poor",
      },
      recommendations: ["No appointments to analyze"],
    };
  }

  // Sort appointments by start time
  const sortedAppointments = [...appointments].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  // Calculate travel times between locations
  const addresses = sortedAppointments.map((a) => a.address);
  const travelData = await getTravelTimes(technicianHomeAddress, addresses);

  // Build route segments
  const segments: RouteSegment[] = [];
  let previousDeparture = new Date(sortedAppointments[0].startTime);
  previousDeparture.setHours(
    previousDeparture.getHours() - 1
  ); // Assume technician leaves home 1 hour before first job

  for (let i = 0; i < sortedAppointments.length; i++) {
    const appointment = sortedAppointments[i];
    const travelInfo = travelData[i] || { duration: 0, distance: 0 };

    const arrivalTime = new Date(previousDeparture);
    arrivalTime.setSeconds(arrivalTime.getSeconds() + travelInfo.duration);

    const departureTime = new Date(arrivalTime);
    departureTime.setMinutes(departureTime.getMinutes() + appointment.duration);

    segments.push({
      address: appointment.address,
      duration: travelInfo.duration,
      distance: travelInfo.distance,
      jobDuration: appointment.duration,
      arrivalTime,
      departureTime,
    });

    previousDeparture = departureTime;
  }

  // Calculate metrics
  const totalJobTime = sortedAppointments.reduce(
    (sum, a) => sum + a.duration,
    0
  );
  const totalTravelTime = segments.reduce((sum, s) => sum + s.duration, 0);
  const totalTravelDistance = segments.reduce((sum, s) => sum + s.distance, 0);

  // Calculate idle time (time between jobs minus travel time)
  let totalIdleTime = 0;
  for (let i = 1; i < segments.length; i++) {
    const timeBetweenJobs =
      segments[i].arrivalTime.getTime() -
      segments[i - 1].departureTime.getTime();
    const travelTime = segments[i].duration * 1000;
    const idleTime = Math.max(0, timeBetweenJobs - travelTime);
    totalIdleTime += idleTime;
  }

  // Calculate total route time (from first departure to last arrival)
  const totalRouteTime =
    segments[segments.length - 1].departureTime.getTime() -
    segments[0].arrivalTime.getTime();

  // Calculate job density (jobs per hour)
  const routeHours = totalRouteTime / (1000 * 60 * 60);
  const jobDensity = routeHours > 0 ? appointments.length / routeHours : 0;

  // Calculate efficiency score (0-100)
  const efficiencyScore = calculateEfficiencyScore({
    jobDensity,
    travelTime: totalTravelTime / 60, // convert to minutes
    travelDistance: totalTravelDistance / 1609.34, // convert to miles
    idleTime: totalIdleTime / (1000 * 60), // convert to minutes
    totalJobTime,
  });

  const rating = getEfficiencyRating(efficiencyScore);

  // Generate recommendations
  const recommendations = generateRecommendations({
    jobDensity,
    travelTime: totalTravelTime / 60,
    travelDistance: totalTravelDistance / 1609.34,
    idleTime: totalIdleTime / (1000 * 60),
    efficiencyScore,
    segments,
  });

  return {
    segments,
    metrics: {
      jobDensity: Math.round(jobDensity * 10) / 10,
      travelTime: Math.round(totalTravelTime / 60), // minutes
      travelDistance: Math.round(totalTravelDistance / 1609.34 * 10) / 10, // miles
      idleTime: Math.round(totalIdleTime / (1000 * 60)), // minutes
      totalRouteTime: Math.round(totalRouteTime / (1000 * 60)), // minutes
      totalJobTime,
      totalTravelTime: Math.round(totalTravelTime / 60), // minutes
      efficiencyScore,
      rating,
    },
    recommendations,
  };
}

function calculateEfficiencyScore(params: {
  jobDensity: number;
  travelTime: number;
  travelDistance: number;
  idleTime: number;
  totalJobTime: number;
}): number {
  let score = 0;

  // Job Density (0-30 points)
  // Ideal: 2-3 jobs per hour
  const idealJobDensity = 2.5;
  const jobDensityScore = Math.max(0, 30 - Math.abs(params.jobDensity - idealJobDensity) * 10);
  score += jobDensityScore;

  // Travel Time (0-25 points)
  // Lower travel time is better
  const idealTravelTime = 60; // 60 minutes total
  const travelTimeScore = Math.max(0, 25 * (1 - params.travelTime / (idealTravelTime * 2)));
  score += travelTimeScore;

  // Travel Distance (0-20 points)
  // Lower distance is better
  const idealDistance = 50; // 50 miles total
  const distanceScore = Math.max(0, 20 * (1 - params.travelDistance / (idealDistance * 2)));
  score += distanceScore;

  // Idle Time (0-25 points)
  // Lower idle time is better
  const idealIdleTime = 30; // 30 minutes total
  const idleTimeScore = Math.max(0, 25 * (1 - params.idleTime / (idealIdleTime * 2)));
  score += idleTimeScore;

  return Math.round(Math.min(100, Math.max(0, score)));
}

function getEfficiencyRating(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

function generateRecommendations(params: {
  jobDensity: number;
  travelTime: number;
  travelDistance: number;
  idleTime: number;
  efficiencyScore: number;
  segments: RouteSegment[];
}): string[] {
  const recommendations: string[] = [];

  if (params.jobDensity < 1.5) {
    recommendations.push("Consider adding more jobs to increase job density");
  }

  if (params.travelTime > 90) {
    recommendations.push("High travel time detected - consider clustering jobs geographically");
  }

  if (params.travelDistance > 80) {
    recommendations.push("Long travel distance - consider reassigning distant jobs to closer technicians");
  }

  if (params.idleTime > 45) {
    recommendations.push("Significant idle time between jobs - consider adjusting schedule");
  }

  if (params.efficiencyScore < 60) {
    recommendations.push("Route efficiency is low - consider route optimization");
  }

  // Check for long gaps between jobs
  for (let i = 1; i < params.segments.length; i++) {
    const gapMinutes =
      (params.segments[i].arrivalTime.getTime() -
        params.segments[i - 1].departureTime.getTime()) /
      (1000 * 60);
    if (gapMinutes > 60) {
      recommendations.push(
        `Large gap (${Math.round(gapMinutes)} min) between jobs ${i} and ${i + 1} - consider filling with additional work`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Route is well optimized");
  }

  return recommendations;
}

/**
 * Optimize a technician's route for the day
 */
export async function optimizeTechnicianRoute(
  technicianHomeAddress: string,
  appointments: Array<{
    address: string;
    duration: number;
    preferredStartTime?: Date;
  }>
): Promise<RouteAnalysis> {
  // Get travel times from home to all appointments
  const addresses = appointments.map((a) => a.address);
  const travelData = await getTravelTimes(technicianHomeAddress, addresses);

  // Optimize route order
  const optimizedRoute = optimizeRoute(technicianHomeAddress, travelData);

  // Reorder appointments based on optimized route
  const reorderedAppointments = optimizedRoute.destinations.map((dest, index) => {
    const originalAppointment = appointments.find((a) => a.address === dest.address);
    // Generate sequential start times for optimized route
    const startTime = new Date();
    startTime.setHours(8 + index, 0, 0, 0); // Start at 8 AM, each job 1 hour apart
    return {
      address: dest.address,
      duration: originalAppointment?.duration || 60,
      startTime,
    };
  });

  // Calculate efficiency for optimized route
  return calculateRouteEfficiency(technicianHomeAddress, reorderedAppointments);
}

/**
 * Compare current vs optimized route efficiency
 */
export async function compareRouteEfficiency(
  technicianHomeAddress: string,
  currentAppointments: Array<{
    address: string;
    duration: number;
    startTime: Date;
  }>
): Promise<{
  current: RouteAnalysis;
  optimized: RouteAnalysis;
  improvement: {
    timeSaved: number;
    distanceSaved: number;
    scoreImprovement: number;
  };
}> {
  const currentAnalysis = await calculateRouteEfficiency(
    technicianHomeAddress,
    currentAppointments
  );

  const optimizedAnalysis = await optimizeTechnicianRoute(
    technicianHomeAddress,
    currentAppointments.map((a) => ({
      address: a.address,
      duration: a.duration,
    }))
  );

  const timeSaved = currentAnalysis.metrics.totalTravelTime - optimizedAnalysis.metrics.totalTravelTime;
  const distanceSaved = currentAnalysis.metrics.travelDistance - optimizedAnalysis.metrics.travelDistance;
  const scoreImprovement = optimizedAnalysis.metrics.efficiencyScore - currentAnalysis.metrics.efficiencyScore;

  return {
    current: currentAnalysis,
    optimized: optimizedAnalysis,
    improvement: {
      timeSaved: Math.max(0, timeSaved),
      distanceSaved: Math.max(0, distanceSaved),
      scoreImprovement: Math.max(0, scoreImprovement),
    },
  };
}
