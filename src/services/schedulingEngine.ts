import { supabase } from '@/lib/supabase';
import { getRoute } from './geocodingService';
import type { SchedulingSlot, Appointment, AvailabilityBlock, User } from '@/types/database';
import { addMinutes, startOfDay, endOfDay, parseISO, isAfter, isBefore, format, addDays } from 'date-fns';

const DEFAULT_DURATION = 60; // minutes
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 17;
const SLOT_INCREMENT = 30; // minutes
const DAYS_AHEAD = 5;
const MAX_SLOTS = 10;

interface TechnicianWithLocation {
  technician: User;
  appointments: Appointment[];
  blocks: AvailabilityBlock[];
}

export async function findBestSlots(
  customerLat: number,
  customerLng: number,
  durationMinutes: number = DEFAULT_DURATION,
): Promise<SchedulingSlot[]> {
  // 1. Get all active technicians
  const { data: technicians } = await supabase
    .from('ss_users')
    .select('*')
    .eq('role', 'technician')
    .eq('active', true);

  if (!technicians || technicians.length === 0) return [];

  // 2. Date range to search
  const now = new Date();
  const searchStart = isAfter(now, startOfBusinessDay(now))
    ? now
    : startOfBusinessDay(now);
  const searchEnd = endOfDay(addDays(now, DAYS_AHEAD));

  // 3. Get existing appointments and blocks for all technicians
  const technicianIds = technicians.map((t) => t.id);

  const [appointmentsResult, blocksResult] = await Promise.all([
    supabase
      .from('ss_appointments')
      .select('*, address:ss_addresses(*)')
      .in('technician_id', technicianIds)
      .gte('start_time', searchStart.toISOString())
      .lte('start_time', searchEnd.toISOString())
      .neq('status', 'cancelled')
      .order('start_time'),
    supabase
      .from('ss_availability_blocks')
      .select('*')
      .in('technician_id', technicianIds)
      .gte('start_time', searchStart.toISOString())
      .lte('end_time', searchEnd.toISOString()),
  ]);

  const allAppointments = (appointmentsResult.data ?? []) as Appointment[];
  const allBlocks = (blocksResult.data ?? []) as AvailabilityBlock[];

  // 4. Build technician context
  const techData: TechnicianWithLocation[] = technicians.map((tech) => ({
    technician: tech as User,
    appointments: allAppointments.filter((a) => a.technician_id === tech.id),
    blocks: allBlocks.filter((b) => b.technician_id === tech.id),
  }));

  // 5. Find available slots for each technician
  const allSlots: SchedulingSlot[] = [];

  for (const td of techData) {
    const slots = await findTechnicianSlots(
      td,
      customerLat,
      customerLng,
      durationMinutes,
      searchStart,
      searchEnd,
    );
    allSlots.push(...slots);
  }

  // 6. Sort by score (lower is better) and return top slots
  allSlots.sort((a, b) => a.score - b.score);
  return allSlots.slice(0, MAX_SLOTS);
}

async function findTechnicianSlots(
  techData: TechnicianWithLocation,
  customerLat: number,
  customerLng: number,
  duration: number,
  searchStart: Date,
  searchEnd: Date,
): Promise<SchedulingSlot[]> {
  const slots: SchedulingSlot[] = [];
  const { technician, appointments, blocks } = techData;

  // Iterate through each day
  let currentDay = startOfDay(searchStart);
  while (isBefore(currentDay, searchEnd)) {
    const dayStart = startOfBusinessDay(currentDay);
    const dayEnd = endOfBusinessDay(currentDay);

    // Skip if day start is in the past
    const effectiveStart = isAfter(searchStart, dayStart) ? searchStart : dayStart;

    // Round up to next slot increment
    const startMinutes = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();
    const roundedMinutes = Math.ceil(startMinutes / SLOT_INCREMENT) * SLOT_INCREMENT;
    let slotStart = new Date(effectiveStart);
    slotStart.setHours(Math.floor(roundedMinutes / 60), roundedMinutes % 60, 0, 0);

    while (isBefore(slotStart, dayEnd)) {
      const slotEnd = addMinutes(slotStart, duration);
      if (isAfter(slotEnd, dayEnd)) break;

      // Check if slot conflicts with existing appointments
      const hasConflict = appointments.some((apt) => {
        const aptStart = parseISO(apt.start_time);
        const aptEnd = parseISO(apt.end_time);
        return isBefore(slotStart, aptEnd) && isAfter(slotEnd, aptStart);
      });

      // Check if slot conflicts with availability blocks
      const isBlocked = blocks.some((block) => {
        const blockStart = parseISO(block.start_time);
        const blockEnd = parseISO(block.end_time);
        return isBefore(slotStart, blockEnd) && isAfter(slotEnd, blockStart);
      });

      if (!hasConflict && !isBlocked) {
        // Calculate travel times
        const { travelBefore, distanceBefore } = await calculateTravelBefore(
          appointments,
          slotStart,
          customerLat,
          customerLng,
        );
        const { travelAfter, distanceAfter } = await calculateTravelAfter(
          appointments,
          slotEnd,
          customerLat,
          customerLng,
        );

        // Calculate workload score
        const dayAppointments = appointments.filter((a) => {
          const aptDate = parseISO(a.start_time);
          return format(aptDate, 'yyyy-MM-dd') === format(slotStart, 'yyyy-MM-dd');
        });
        const workloadWeight = dayAppointments.length * 5;

        // Schedule density: prefer slots that fill gaps efficiently
        const densityWeight = calculateDensityWeight(appointments, slotStart, slotEnd);

        // Final score
        const score = travelBefore + travelAfter + workloadWeight + densityWeight;

        // Convert score to star rating (1-5)
        const rating = Math.max(1, Math.min(5, Math.round(5 - score / 20)));

        slots.push({
          technician_id: technician.id,
          technician_name: technician.name,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          score,
          rating,
          travel_time_before: travelBefore,
          travel_time_after: travelAfter,
          distance_before: distanceBefore,
          distance_after: distanceAfter,
        });
      }

      slotStart = addMinutes(slotStart, SLOT_INCREMENT);
    }

    currentDay = addDays(currentDay, 1);
  }

  return slots;
}

async function calculateTravelBefore(
  appointments: Appointment[],
  slotStart: Date,
  customerLat: number,
  customerLng: number,
): Promise<{ travelBefore: number; distanceBefore: number }> {
  // Find the previous appointment
  const prevAppointments = appointments
    .filter((a) => isBefore(parseISO(a.end_time), slotStart))
    .sort((a, b) => parseISO(b.end_time).getTime() - parseISO(a.end_time).getTime());

  if (prevAppointments.length === 0) {
    return { travelBefore: 0, distanceBefore: 0 };
  }

  const prev = prevAppointments[0];
  const prevAddress = prev.address;

  if (!prevAddress?.latitude || !prevAddress?.longitude) {
    return { travelBefore: 10, distanceBefore: 5 }; // Default estimate
  }

  const route = await getRoute(
    prevAddress.latitude,
    prevAddress.longitude,
    customerLat,
    customerLng,
  );

  return {
    travelBefore: route?.duration ?? 10,
    distanceBefore: route?.distance ?? 5,
  };
}

async function calculateTravelAfter(
  appointments: Appointment[],
  slotEnd: Date,
  customerLat: number,
  customerLng: number,
): Promise<{ travelAfter: number; distanceAfter: number }> {
  const nextAppointments = appointments
    .filter((a) => isAfter(parseISO(a.start_time), slotEnd))
    .sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime());

  if (nextAppointments.length === 0) {
    return { travelAfter: 0, distanceAfter: 0 };
  }

  const next = nextAppointments[0];
  const nextAddress = next.address;

  if (!nextAddress?.latitude || !nextAddress?.longitude) {
    return { travelAfter: 10, distanceAfter: 5 };
  }

  const route = await getRoute(
    customerLat,
    customerLng,
    nextAddress.latitude,
    nextAddress.longitude,
  );

  return {
    travelAfter: route?.duration ?? 10,
    distanceAfter: route?.distance ?? 5,
  };
}

function calculateDensityWeight(
  appointments: Appointment[],
  slotStart: Date,
  slotEnd: Date,
): number {
  // Prefer slots that are adjacent to existing appointments (reduce idle time)
  const bufferMinutes = 30;

  const hasNearbyBefore = appointments.some((a) => {
    const aptEnd = parseISO(a.end_time);
    const diff = Math.abs(slotStart.getTime() - aptEnd.getTime()) / 60000;
    return diff <= bufferMinutes;
  });

  const hasNearbyAfter = appointments.some((a) => {
    const aptStart = parseISO(a.start_time);
    const diff = Math.abs(aptStart.getTime() - slotEnd.getTime()) / 60000;
    return diff <= bufferMinutes;
  });

  // Lower density weight means slot fills gap better
  if (hasNearbyBefore && hasNearbyAfter) return -10;
  if (hasNearbyBefore || hasNearbyAfter) return -5;
  return 0;
}

function startOfBusinessDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(BUSINESS_START_HOUR, 0, 0, 0);
  return d;
}

function endOfBusinessDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(BUSINESS_END_HOUR, 0, 0, 0);
  return d;
}
