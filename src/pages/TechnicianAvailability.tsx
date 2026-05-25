import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Save, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toESTDate } from "@/lib/timezone";

interface AvailabilityDay {
  id: string;
  date: string;
  is_available: boolean;
  notes: string | null;
  unavailable_start_time: string | null;
  unavailable_end_time: string | null;
}

export default function TechnicianAvailability() {
  const { toast } = useToast();
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [editIsAvailable, setEditIsAvailable] = useState(true);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Generate next 30 days
  const generateDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const [next30Days] = useState(generateDays());

  const fetchAvailability = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }

      // Get technician ID
      const { data: techData, error: techError } = await supabase
        .from('technicians')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (techError || !techData) {
        setLoading(false);
        return;
      }

      // Fetch availability for next 30 days
      const { data, error } = await supabase
        .from('technician_availability')
        .select('*')
        .eq('technician_id', techData.id)
        .gte('date', next30Days[0])
        .lte('date', next30Days[next30Days.length - 1])
        .order('date', { ascending: true });

      if (error) throw error;

      // Create a map of existing availability
      const availabilityMap = new Map(data?.map(d => [d.date, d]) || []);

      // Fill in missing days as available by default
      const fullAvailability = next30Days.map(date => {
        const existing = availabilityMap.get(date);
        if (existing) {
          return existing;
        }
        return {
          id: '',
          date,
          is_available: true,
          notes: null,
          unavailable_start_time: null,
          unavailable_end_time: null,
        };
      });

      setAvailability(fullAvailability);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching availability:', error);
      toast({ title: "Error", description: "Failed to load availability", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [next30Days, toast]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailability();
  };

  const openEditModal = (day: AvailabilityDay) => {
    setSelectedDate(day.date);
    setEditIsAvailable(day.is_available);
    setEditNote(day.notes || '');
    setEditStartTime(day.unavailable_start_time || '');
    setEditEndTime(day.unavailable_end_time || '');
    setShowEditModal(true);
  };

  const saveAvailability = async () => {
    if (!selectedDate) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }

      const { data: techData } = await supabase
        .from('technicians')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!techData) {
        toast({ title: "Error", description: "Technician profile not found", variant: "destructive" });
        return;
      }

      // Use upsert for atomic operation
      const { error } = await supabase
        .from('technician_availability')
        .upsert({
          technician_id: techData.id,
          date: selectedDate,
          is_available: editIsAvailable,
          notes: editNote || null,
          unavailable_start_time: !editIsAvailable && editStartTime ? editStartTime : null,
          unavailable_end_time: !editIsAvailable && editEndTime ? editEndTime : null,
        }, {
          onConflict: 'technician_id,date'
        });

      if (error) throw error;

      toast({ title: "Success", description: "Availability updated" });
      setShowEditModal(false);
      fetchAvailability();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error saving availability:', error);
      toast({ title: "Error", description: "Failed to update availability", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">My Availability</h1>
          <p className="text-muted-foreground">Set your available days and times for the next 30 days</p>
        </div>
        <Button onClick={onRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Schedule Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {availability.map((day) => {
              const dateObj = new Date(day.date + 'T00:00:00');
              const isToday = dateObj.toDateString() === new Date().toDateString();
              const isPast = dateObj < new Date();
              
              return (
                <button
                  key={day.date}
                  onClick={() => !isPast && openEditModal(day)}
                  disabled={isPast}
                  className={`
                    p-3 rounded-lg border text-left transition-all
                    ${isPast ? 'opacity-50 cursor-not-allowed bg-muted' : 'hover:border-primary cursor-pointer'}
                    ${day.is_available ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}
                    ${isToday ? 'ring-2 ring-primary' : ''}
                  `}
                >
                  <div className="font-medium text-sm">
                    {format(dateObj, 'MMM d')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(dateObj, 'EEE')}
                  </div>
                  <div className={`text-xs mt-1 ${day.is_available ? 'text-green-600' : 'text-red-600'}`}>
                    {day.is_available ? 'Available' : day.unavailable_start_time && day.unavailable_end_time ? `${day.unavailable_start_time.slice(0, 5)}–${day.unavailable_end_time.slice(0, 5)}` : 'Unavailable'}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {showEditModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Edit Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{format(toESTDate(selectedDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}</Label>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="available">Available</Label>
                <Switch
                  id="available"
                  checked={editIsAvailable}
                  onCheckedChange={setEditIsAvailable}
                />
              </div>

              {!editIsAvailable && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <Label className="text-sm font-medium">Unavailable time range (optional)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="start-time" className="text-xs">Start time</Label>
                      <Input
                        id="start-time"
                        type="time"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-time" className="text-xs">End time</Label>
                      <Input
                        id="end-time"
                        type="time"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave blank to mark the entire day as unavailable
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Add any notes about your availability..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveAvailability}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
