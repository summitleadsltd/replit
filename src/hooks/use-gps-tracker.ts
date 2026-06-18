import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GpsTrackerOptions {
  technicianId: string;
  enabled?: boolean;
  interval?: number; // milliseconds between updates
  onLocationUpdate?: (location: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
  }) => void;
}

export function useGpsTracker({
  technicianId,
  enabled = true,
  interval = 60000, // 60 seconds by default
  onLocationUpdate,
}: GpsTrackerOptions) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<{
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const startTracking = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser");
      return;
    }

    try {
      setIsTracking(true);
      setError(null);

      // Use watchPosition for continuous tracking
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed || null,
            heading: position.coords.heading || null,
          };

          setLastLocation(location);
          onLocationUpdate?.(location);

          // Send to database
          await sendLocationToDatabase(location);
        },
        (err) => {
          console.error("Geolocation error:", err);
          setError(getGeolocationErrorMessage(err.code));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch (err) {
      console.error("Error starting GPS tracking:", err);
      setError("Failed to start GPS tracking");
      setIsTracking(false);
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  };

  const sendLocationToDatabase = async (location: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
  }) => {
    try {
      // Get battery level if available
      let batteryLevel: number | null = null;
      if ("getBattery" in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          batteryLevel = Math.round(battery.level * 100);
        } catch (e) {
          // Battery API not supported or permission denied
        }
      }

      const { error } = await supabase
        .from("technician_location_history")
        .insert({
          technician_id: technicianId,
          latitude: location.latitude,
          longitude: location.longitude,
          speed: location.speed,
          heading: location.heading,
          battery_level: batteryLevel,
        });

      if (error) {
        console.error("Error sending location to database:", error);
      }
    } catch (err) {
      console.error("Error in sendLocationToDatabase:", err);
    }
  };

  const getCurrentLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  useEffect(() => {
    if (enabled && technicianId) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, technicianId]);

  return {
    isTracking,
    lastLocation,
    error,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };
}

function getGeolocationErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return "Location permission denied. Please enable location services.";
    case 2:
      return "Unable to determine location. Please check your GPS settings.";
    case 3:
      return "Location request timed out. Please try again.";
    default:
      return "An unknown error occurred while getting your location.";
  }
}
