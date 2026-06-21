import { useEffect, useState, useCallback } from 'react';
import { getCustomers } from '@/services/customerService';
import { getAppointments } from '@/services/appointmentService';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppointmentStatusBadge } from '@/components/shared/AppointmentStatusBadge';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import type { Customer, Address, Appointment } from '@/types/database';

export function CustomersPage() {
  const [customers, setCustomers] = useState<(Customer & { addresses: Address[] })[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<(Customer & { addresses: Address[] })[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<(Customer & { addresses: Address[] }) | null>(null);
  const [customerAppointments, setCustomerAppointments] = useState<Appointment[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
      setFilteredCustomers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!search) {
      setFilteredCustomers(customers);
    } else {
      const q = search.toLowerCase();
      setFilteredCustomers(
        customers.filter(
          (c) =>
            c.first_name.toLowerCase().includes(q) ||
            c.last_name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.phone.includes(q),
        ),
      );
    }
  }, [search, customers]);

  const viewCustomer = async (customer: Customer & { addresses: Address[] }) => {
    setSelectedCustomer(customer);
    const appts = await getAppointments();
    setCustomerAppointments(appts.filter((a) => a.customer_id === customer.id));
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Customers</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => viewCustomer(customer)}
                >
                  <TableCell className="font-medium">
                    {customer.first_name} {customer.last_name}
                  </TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.addresses[0]?.address_line || 'No address'}
                  </TableCell>
                </TableRow>
              ))}
              {filteredCustomers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer?.first_name} {selectedCustomer?.last_name}
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedCustomer.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedCustomer.phone}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Appointment History</h4>
                {customerAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointments</p>
                ) : (
                  <div className="space-y-2">
                    {customerAppointments.map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between p-2 rounded border">
                        <div>
                          <p className="text-sm font-medium capitalize">{apt.appointment_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(apt.start_time), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <AppointmentStatusBadge status={apt.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
