import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { supabase, Appointment, Contact, Technician } from '../lib/supabase';
import { colors, STATUS_COLORS, shadows, spacing, borderRadius } from '../lib/theme';

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;

type AppointmentWithContact = Appointment & {
  contacts: Contact | null;
};

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const [appointments, setAppointments] = useState<AppointmentWithContact[]>([]);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Appointment['status'] | 'all'>('all');

  // Fetch technician profile and appointments
  const fetchData = useCallback(async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Not Authenticated', 'Please sign in.', [
          { text: 'Sign Out', onPress: () => supabase.auth.signOut() }
        ]);
        return;
      }

      // Get current technician
      const { data: techData, error: techError } = await supabase
        .from('technicians')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (techError) {
        if (techError.code === 'PGRST116') {
          Alert.alert(
            'Not Registered',
            'You are not registered as a technician. Please contact an administrator.',
            [{ text: 'Sign Out', onPress: () => supabase.auth.signOut() }]
          );
          return;
        }
        throw techError;
      }

      setTechnician(techData);

      // Fetch appointments for this technician (today and future)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select(`
          *,
          contacts (
            id,
            first_name,
            last_name,
            phone_e164,
            address,
            city,
            state,
            zip_code
          )
        `)
        .eq('technician_id', techData.id)
        .gte('appointment_at', today.toISOString())
        .order('appointment_at', { ascending: true });

      if (apptsError) throw apptsError;
      setAppointments(appts || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates for this technician only
    const subscription = supabase
      .channel('appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          // Only refresh if this appointment belongs to the current technician
          if (payload.new?.technician_id === session?.user?.id ||
              payload.old?.technician_id === session?.user?.id) {
            fetchData();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const filteredAppointments = filter === 'all' 
    ? appointments 
    : appointments.filter(a => a.status === filter);

  const getStatusColor = (status: Appointment['status']) => {
    const colors: Record<string, string> = STATUS_COLORS;
    return colors[status] || '#8E8E93';
  };

  const formatDate = (dateString: string) => {
    // Parse ISO date and display in UTC timezone
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const formatTime = (dateString: string) => {
    // Parse ISO date and display in UTC timezone
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      timeZone: 'UTC'
    });
  };

  const renderAppointment = ({ item }: { item: AppointmentWithContact }) => (
    <TouchableOpacity
      style={styles.appointmentCard}
      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
    >
      <View style={styles.appointmentHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
        <Text style={styles.appointmentTime}>{formatTime(item.appointment_at)}</Text>
      </View>
      
      <Text style={styles.customerName}>
        {item.contacts?.first_name || ''} {item.contacts?.last_name || ''}
      </Text>
      
      <Text style={styles.address}>
        {item.contacts?.address || item.address}
        {item.contacts?.city && `, ${item.contacts.city}`}
      </Text>
      
      {item.contacts?.phone_e164 && (
        <Text style={styles.phone}>{item.contacts.phone_e164}</Text>
      )}
    </TouchableOpacity>
  );

  const FilterButton = ({ status, label }: { status: Appointment['status'] | 'all', label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === status && styles.filterButtonActive]}
      onPress={() => setFilter(status)}
    >
      <Text style={[styles.filterButtonText, filter === status && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Today's Schedule</Text>
          <Text style={styles.headerSubtitle}>
            {technician ? `Hello, ${technician.name}` : 'Loading...'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => navigation.navigate('Availability')} style={styles.availabilityButton}>
            <Text style={styles.availabilityText}>Availability</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <FilterButton status="all" label="All" />
        <FilterButton status="booked" label="Booked" />
        <FilterButton status="on_route" label="On Route" />
        <FilterButton status="in_progress" label="Working" />
        <FilterButton status="completed" label="Done" />
      </View>

      <FlatList
        data={filteredAppointments}
        renderItem={renderAppointment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No appointments found</Text>
            <Text style={styles.emptyStateSubtext}>
              {filter === 'all' 
                ? 'You have no scheduled appointments' 
                : `No appointments with "${filter.replace('_', ' ')}" status`}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  availabilityButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  availabilityText: {
    color: colors.successForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  signOutButton: {
    padding: spacing.sm,
  },
  signOutText: {
    color: colors.primary,
    fontSize: 14,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.muted,
    marginRight: spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  filterButtonTextActive: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  list: {
    padding: spacing.md,
  },
  appointmentCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    backgroundColor: colors.secondary,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  appointmentTime: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  address: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  phone: {
    fontSize: 14,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 8,
  },
});
