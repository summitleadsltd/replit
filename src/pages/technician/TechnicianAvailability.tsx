import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  getAvailabilityBlocks,
  createAvailabilityBlock,
  deleteAvailabilityBlock,
} from '@/services/technicianService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { AvailabilityBlock } from '@/types/database';

export function TechnicianAvailability() {
  const { profile } = useAuthStore();
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    start_date: '',
    start_time: '09:00',
    end_date: '',
    end_time: '17:00',
    reason: 'personal',
  });

  const loadBlocks = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await getAvailabilityBlocks(profile.id);
      setBlocks(data);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const handleCreate = async () => {
    if (!profile) return;
    await createAvailabilityBlock({
      technician_id: profile.id,
      start_time: new Date(`${form.start_date}T${form.start_time}`).toISOString(),
      end_time: new Date(`${form.end_date}T${form.end_time}`).toISOString(),
      reason: form.reason,
    });
    setDialogOpen(false);
    setForm({ start_date: '', start_time: '09:00', end_date: '', end_time: '17:00', reason: 'personal' });
    loadBlocks();
  };

  const handleDelete = async (id: string) => {
    await deleteAvailabilityBlock(id);
    loadBlocks();
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Availability</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-2" />
            Add Block
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Unavailable Block</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select
                  value={form.reason}
                  onValueChange={(value) => setForm({ ...form, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full">
                Save Block
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unavailable Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No availability blocks set</p>
          ) : (
            <div className="space-y-3">
              {blocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm capitalize">{block.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(block.start_time), 'MMM d, yyyy h:mm a')} -{' '}
                      {format(new Date(block.end_time), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(block.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
