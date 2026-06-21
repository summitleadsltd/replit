import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Settings {
  business_hours_start: string;
  business_hours_end: string;
  default_appointment_duration: number;
  working_days: number[];
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    business_hours_start: '08:00',
    business_hours_end: '17:00',
    default_appointment_duration: 60,
    working_days: [1, 2, 3, 4, 5],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('ss_business_settings')
          .select('*')
          .single();
        if (data) {
          setSettings({
            business_hours_start: data.business_hours_start,
            business_hours_end: data.business_hours_end,
            default_appointment_duration: data.default_appointment_duration,
            working_days: data.working_days,
          });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('ss_business_settings')
        .upsert({
          id: '1',
          ...settings,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const toggleDay = (day: number) => {
    setSettings((prev) => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={settings.business_hours_start}
                onChange={(e) =>
                  setSettings({ ...settings, business_hours_start: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={settings.business_hours_end}
                onChange={(e) =>
                  setSettings({ ...settings, business_hours_end: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Working Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dayNames.map((name, index) => (
              <div key={index} className="flex items-center justify-between">
                <Label>{name}</Label>
                <Switch
                  checked={settings.working_days.includes(index)}
                  onCheckedChange={() => toggleDay(index)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointment Defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Default Duration (minutes)</Label>
            <Input
              type="number"
              value={settings.default_appointment_duration}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_appointment_duration: parseInt(e.target.value) || 60,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} size="lg">
        Save Settings
      </Button>
    </div>
  );
}
