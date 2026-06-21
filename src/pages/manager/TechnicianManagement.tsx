import { useEffect, useState, useCallback } from 'react';
import { getTechnicians, updateTechnician } from '@/services/technicianService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil } from 'lucide-react';
import type { User } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function TechnicianManagement() {
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const load = useCallback(async () => {
    try {
      const data = await getTechnicians();
      setTechnicians(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    try {
      // Create auth user
      const tempPassword = 'TempPass' + Math.random().toString(36).slice(2, 8) + '!';
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: form.email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authError) {
        // Fallback: just create the profile if admin API not available
        const { error: profileError } = await supabase
          .from('ss_users')
          .insert({
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: 'technician',
            active: true,
          });
        if (profileError) throw profileError;
      } else if (authData.user) {
        const { error: profileError } = await supabase
          .from('ss_users')
          .insert({
            id: authData.user.id,
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: 'technician',
            active: true,
          });
        if (profileError) throw profileError;
      }

      toast.success('Technician created');
      setCreateDialogOpen(false);
      setForm({ name: '', email: '', phone: '' });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create technician');
    }
  };

  const handleEdit = (tech: User) => {
    setEditingTech(tech);
    setForm({ name: tech.name, email: tech.email, phone: tech.phone || '' });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTech) return;
    try {
      await updateTechnician(editingTech.id, {
        name: form.name,
        phone: form.phone,
      });
      toast.success('Technician updated');
      setEditDialogOpen(false);
      load();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleToggleActive = async (tech: User) => {
    try {
      await updateTechnician(tech.id, { active: !tech.active });
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Technician Management</h1>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 mr-2" />
            Add Technician
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Technician</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">
                Create Technician
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {technicians.map((tech) => (
                <TableRow key={tech.id}>
                  <TableCell className="font-medium">{tech.name}</TableCell>
                  <TableCell>{tech.email}</TableCell>
                  <TableCell>{tech.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant={tech.active ? 'default' : 'secondary'}>
                      {tech.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(tech)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={tech.active}
                        onCheckedChange={() => handleToggleActive(tech)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Technician</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} disabled />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <Button onClick={handleUpdate} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
