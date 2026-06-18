import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConfirmationOptions {
  method?: "email" | "sms" | "whatsapp";
}

export function useSendAppointmentConfirmation() {
  return useMutation({
    mutationFn: async ({ appointmentId, method = "email" }: ConfirmationOptions & { appointmentId: string }) => {
      const { data, error } = await supabase.functions.invoke("send-appointment-confirmation", {
        body: { appointmentId, method },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Confirmation sent successfully");
      } else {
        toast.warning(data.message || "Could not send confirmation");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to send confirmation: ${error.message}`);
    },
  });
}

export function useConfirmAppointment() {
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          confirmation_status: "confirmed",
          status: "confirmed",
        })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment confirmed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm appointment: ${error.message}`);
    },
  });
}

export function useRescheduleAppointment() {
  return useMutation({
    mutationFn: async ({ appointmentId, newDateTime }: { appointmentId: string; newDateTime: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          appointment_at: newDateTime,
          confirmation_status: "rescheduled",
          status: "rescheduled",
        })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment rescheduled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reschedule appointment: ${error.message}`);
    },
  });
}

export function useCancelAppointment() {
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          confirmation_status: "cancelled",
          status: "cancelled",
        })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment cancelled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel appointment: ${error.message}`);
    },
  });
}
