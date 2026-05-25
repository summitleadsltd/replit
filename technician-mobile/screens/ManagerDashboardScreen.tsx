import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
  TextInput,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { supabase, Appointment, Technician } from '../lib/supabase';
import { colors, STATUS_COLORS, shadows, spacing, borderRadius } from '../lib/theme';

type ManagerDashboardNavigationProp = StackNavigationProp<RootStackParamList, 'ManagerDashboard'>;

// Using STATUS_COLORS from theme.ts

export default function ManagerDashboardScreen() {
  const navigation = useNavigation<ManagerDashboardNavigationProp>();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<(Appointment & { contacts: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isManager, setIsManager] = useState(false);

  // Check if user is manager
  useEffect(() => {
    checkManagerStatus();
  }, []);

  const checkManagerStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check user_roles for manager/supervisor/admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'manager', 'supervisor']);
    
    setIsManager(!!(roles && roles.length > 0));
  };

  const fetchTechnicians = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  }, []);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('appointments')
        .select(`
          *,
          contacts (
            id,
            first_name,
            last_name,
            phone_e164,
            email,
            address
          )
        `)
        .order('appointment_at', { ascending: true });

      // Filter by technician if selected
      if (selectedTechId) {
        query = query.eq('technician_id', selectedTechId);
      }

      // Filter by status if selected
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      Alert.alert('Error', 'Failed to load appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTechId, statusFilter]);

  useEffect(() => {
    if (isManager) {
      fetchTechnicians();
      fetchAppointments();
    }
  }, [isManager, fetchTechnicians, fetchAppointments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status: string) => STATUS_COLORS[status] || '#8E8E93';

  const renderTechnicianFilter = () => (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>Filter by Technician:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.techList}>
        <TouchableOpacity
          style={[styles.techChip, selectedTechId === null && styles.techChipActive]}
          onPress={() => setSelectedTechId(null)}
        >
          <Text style={[styles.techChipText, selectedTechId === null && styles.techChipTextActive]}>
            All Technicians
          </Text>
        </TouchableOpacity>
        {technicians.map(tech => (
          <TouchableOpacity
            key={tech.id}
            style={[styles.techChip, selectedTechId === tech.id && styles.techChipActive]}
            onPress={() => setSelectedTechId(tech.id === selectedTechId ? null : tech.id)}
          >
            <Text style={[styles.techChipText, selectedTechId === tech.id && styles.techChipTextActive]}>
              {tech.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderStatusFilter = () => (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>Filter by Status:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusList}>
        <TouchableOpacity
          style={[styles.statusChip, statusFilter === null && styles.statusChipActive]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[styles.statusChipText, statusFilter === null && styles.statusChipTextActive]}>
            All Status
          </Text>
        </TouchableOpacity>
        {Object.keys(STATUS_COLORS).map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.statusChip, statusFilter === status && styles.statusChipActive]}
            onPress={() => setStatusFilter(status === statusFilter ? null : status)}
          >
            <Text style={[styles.statusChipText, statusFilter === status && styles.statusChipTextActive]}>
              {status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderAppointment = ({ item }: { item: Appointment & { contacts: any } }) => (
    <TouchableOpacity 
      style={styles.appointmentCard}
      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
    >
      <View style={styles.appointmentHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status?.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.timeText}>{formatDate(item.appointment_at)} • {formatTime(item.appointment_at)}</Text>
      </View>
      
      <Text style={styles.customerName}>
        {item.contacts?.first_name} {item.contacts?.last_name}
      </Text>
      <Text style={styles.customerPhone}>{item.contacts?.phone_e164}</Text>
      
      {item.address && <Text style={styles.address}>{item.address}</Text>}
      
      <View style={styles.appointmentFooter}>
        <Text style={styles.statusLabel}>{item.status?.replace(/_/g, ' ') || 'No status'}</Text>
      </View>
    </TouchableOpacity>
  );

  const getStats = () => {
    const stats = {
      total: appointments.length,
      sale: appointments.filter(a => a.status === 'sale').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      inProgress: appointments.filter(a => ['on_route', 'in_progress'].includes(a.status)).length,
      pending: appointments.filter(a => ['booked', 'confirmed'].includes(a.status)).length,
    };
    return stats;
  };

  const stats = getStats();

  const filteredAppointments = appointments.filter(appt => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const firstName = appt.contacts?.first_name;
    const lastName = appt.contacts?.last_name;
    const phone = appt.contacts?.phone_e164;
    return (firstName && firstName.toLowerCase().includes(query)) ||
           (lastName && lastName.toLowerCase().includes(query)) ||
           (phone && phone.includes(query));
  });

  if (!isManager) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Manager access required</Text>
        <Text style={styles.errorSubtext}>Contact your administrator for access</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manager Dashboard</Text>
        <Text style={styles.subtitle}>Oversee all technician activities</Text>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#30D158' }]}>{stats.sale}</Text>
          <Text style={styles.statLabel}>Sales</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#34C759' }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#FF9500' }]}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filters */}
      {renderTechnicianFilter()}
      {renderStatusFilter()}

      {/* Appointments List */}
      <FlatList
        data={filteredAppointments}
        keyExtractor={(item) => item.id}
        renderItem={renderAppointment}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No appointments found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  filterSection: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  techList: {
    paddingHorizontal: 8,
  },
  techChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  techChipActive: {
    backgroundColor: '#007AFF',
  },
  techChipText: {
    fontSize: 13,
    color: '#333',
  },
  techChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  statusList: {
    paddingHorizontal: 8,
  },
  statusChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statusChipActive: {
    backgroundColor: '#5856D6',
  },
  statusChipText: {
    fontSize: 11,
    color: '#666',
    textTransform: 'capitalize',
  },
  statusChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  listContainer: {
    padding: 12,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
  },
  address: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  appointmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 100,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});
