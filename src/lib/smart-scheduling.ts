import { supabase } from "@/integrations/supabase/client";
import { getTravelTime } from "./google-maps";
import { appTodayBounds } from "./timezone";

interface SchedulingRequest {
  requestedDateTime: Date;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  requiredSkills?: string[];
  durationMinutes?: number;
}

interface TechnicianAvailability {
  technicianId: string;
  technicianName: string;
  isAvailable: boolean;
  capacityScore: number;
  travelTime: number;
  travelDistance: number;
  previousJobEndTime?: Date;
  nextJobStartTime?: Date;
  currentJobCount: number;
  maxJobs: number;
  currentDriveTime: number;
  maxDriveTime: number;
  currentDistance: number;
  maxDistance: number;
  efficiencyScore: number;
  reason?: string;
}

interface SchedulingResult {
  availableTechnicians: TechnicianAvailability[];
  recommendedTechnician?: TechnicianAvailability;
  unavailableCount: number;
}

/**
 * Smart Scheduling Window
 * Analyzes technician availability considering:
 * - ZIP territory match
 * - Capacity constraints (max jobs, drive time, mileage)
 * - Travel time from current location/previous job
 * - Current job duration analysis
 * - Returns efficiency score for each technician
 */
export async function analyzeSchedulingWindow(
  request: SchedulingRequest
): Promise<SchedulingResult> {
  const fullAddress = [request.address, request.city, request.state, request.zipCode]
    .filter(Boolean)
    .join(", ");

  // Get today's bounds in Eastern timezone
  const { start: dayStart, end: dayEnd } = appTodayBounds();

  // Get all active technicians
  const { data: technicians, error: techError } = await supabase
    .from("technicians")
    .select("*")
    .eq("is_active", true);

  if (techError || !technicians) {
    console.error("Error fetching technicians:", techError);
    return { availableTechnicians: [], unavailableCount: 0 };
  }

  // Get technician territories for ZIP matching
  const { data: territories } = await supabase
    .from("technician_territories")
    .select("*")
    .eq("active", true);

  // Get technician appointments for the requested day
  const { data: appointments } = await supabase
    .from("technician_appointments")
    .select("*")
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd)
    .not("status", "in", "(cancelled,no_show)")
    .order("start_time", { ascending: true });

  // Analyze each technician
  const availabilityResults: TechnicianAvailability[] = [];

  for (const tech of technicians) {
    const result = await analyzeTechnicianAvailability(
      tech,
      request.requestedDateTime,
      fullAddress,
      territories || [],
      appointments || [],
      request.durationMinutes || 60
    );
    availabilityResults.push(result);
  }

  // Sort by efficiency score (highest first)
  availabilityResults.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  // Separate available from unavailable
  const available = availabilityResults.filter((t) => t.isAvailable);
  const unavailable = availabilityResults.filter((t) => !t.isAvailable);

  return {
    availableTechnicians: available,
    recommendedTechnician: available[0],
    unavailableCount: unavailable.length,
  };
}

async function analyzeTechnicianAvailability(
  technician: any,
  requestedDateTime: Date,
  destinationAddress: string,
  territories: any[],
  dayAppointments: any[],
  jobDurationMinutes: number
): Promise<TechnicianAvailability> {
  const techAppointments = dayAppointments.filter(
    (a) => a.technician_id === technician.id
  );

  // Check ZIP territory match
  const zipCode = destinationAddress.split(", ").pop();
  const territoryMatch = territories.some(
    (t) =>
      t.technician_id === technician.id && t.zip_code === zipCode
  );

  // Get previous job end time
  const previousJob = techAppointments
    .filter((a) => new Date(a.end_time) < requestedDateTime)
    .sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())[0];

  const previousJobEndTime = previousJob
    ? new Date(previousJob.end_time)
    : null;

  // Get next job start time
  const nextJob = techAppointments
    .filter((a) => new Date(a.start_time) > requestedDateTime)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  const nextJobStartTime = nextJob ? new Date(nextJob.start_time) : null;

  // Calculate travel time from previous job or home
  let originAddress = technician.home_address || "";
  if (previousJobEndTime && previousJob?.lead_address) {
    originAddress = previousJob.lead_address;
  }

  const travelInfo = await getTravelTime(originAddress, destinationAddress);
  const travelTime = travelInfo?.duration || 0;
  const travelDistance = travelInfo?.distance || 0;

  // Check capacity constraints
  const currentJobCount = technician.current_job_count || techAppointments.length;
  const maxJobs = technician.max_jobs_per_day || 8;
  const currentDriveTime = technician.current_drive_time_minutes || 0;
  const maxDriveTime = technician.max_drive_time_minutes || 180;
  const currentDistance = technician.current_distance_miles || 0;
  const maxDistance = technician.max_distance_miles || 120;

  // Check if technician can fit the job
  let isAvailable = true;
  let reason = "";

  // Check job count capacity
  if (currentJobCount >= maxJobs) {
    isAvailable = false;
    reason = "Maximum jobs per day reached";
  }

  // Check drive time capacity
  if (currentDriveTime + travelTime > maxDriveTime) {
    isAvailable = false;
    reason = "Maximum drive time exceeded";
  }

  // Check distance capacity
  if (currentDistance + travelDistance > maxDistance) {
    isAvailable = false;
    reason = "Maximum distance exceeded";
  }

  // Check if job fits in schedule
  if (previousJobEndTime) {
    const timeBetweenJobs =
      requestedDateTime.getTime() - previousJobEndTime.getTime();
    const requiredBuffer = travelTime * 1000 * 60; // Convert to milliseconds

    if (timeBetweenJobs < requiredBuffer) {
      isAvailable = false;
      reason = "Insufficient time between jobs";
    }
  }

  if (nextJobStartTime) {
    const timeBetweenJobs =
      nextJobStartTime.getTime() -
      (requestedDateTime.getTime() + jobDurationMinutes * 60 * 1000);
    const requiredBuffer = travelTime * 1000 * 60;

    if (timeBetweenJobs < requiredBuffer) {
      isAvailable = false;
      reason = "Insufficient time to reach next job";
    }
  }

  // Calculate efficiency score (0-100)
  let efficiencyScore = 0;

  // Territory match: +30 points
  if (territoryMatch) {
    efficiencyScore += 30;
  }

  // Capacity utilization: +20 points (lower utilization = higher score)
  const capacityUtilization = currentJobCount / maxJobs;
  efficiencyScore += (1 - capacityUtilization) * 20;

  // Travel time efficiency: +25 points (lower travel time = higher score)
  const maxTravelTime = 60; // 60 minutes
  const travelEfficiency = Math.max(0, 1 - travelTime / maxTravelTime);
  efficiencyScore += travelEfficiency * 25;

  // Schedule fit: +25 points (better fit = higher score)
  if (previousJobEndTime) {
    const timeBuffer =
      (requestedDateTime.getTime() - previousJobEndTime.getTime()) /
      (1000 * 60);
    const idealBuffer = 30; // 30 minutes
    const bufferEfficiency = Math.max(0, 1 - Math.abs(timeBuffer - idealBuffer) / idealBuffer);
    efficiencyScore += bufferEfficiency * 25;
  } else {
    efficiencyScore += 25; // First job of the day
  }

  return {
    technicianId: technician.id,
    technicianName: technician.name,
    isAvailable,
    capacityScore: (1 - capacityUtilization) * 100,
    travelTime,
    travelDistance,
    previousJobEndTime,
    nextJobStartTime,
    currentJobCount,
    maxJobs,
    currentDriveTime,
    maxDriveTime,
    currentDistance,
    maxDistance,
    efficiencyScore: Math.round(efficiencyScore),
    reason: isAvailable ? undefined : reason,
  };
}

/**
 * Get recommended technician for a scheduling request
 */
export async function getRecommendedTechnician(
  request: SchedulingRequest
): Promise<TechnicianAvailability | null> {
  const result = await analyzeSchedulingWindow(request);
  return result.recommendedTechnician || null;
}

/**
 * Check if a specific technician is available for a time slot
 */
export async function checkTechnicianAvailability(
  technicianId: string,
  requestedDateTime: Date,
  address: string
): Promise<boolean> {
  const { data: technician } = await supabase
    .from("technicians")
    .select("*")
    .eq("id", technicianId)
    .single();

  if (!technician) return false;

  const result = await analyzeTechnicianAvailability(
    technician,
    requestedDateTime,
    address,
    [],
    [],
    60
  );

  return result.isAvailable;
}
