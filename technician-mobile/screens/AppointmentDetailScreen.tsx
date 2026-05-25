import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { supabase, Appointment, Contact, JobCard, AppointmentStatus } from '../lib/supabase';
import { colors, STATUS_COLORS, shadows, spacing, borderRadius } from '../lib/theme';
import ImageUpload from '../components/ImageUpload';
import { formatAppDateTime } from '../lib/timezone';

type AppointmentDetailRouteProp = {
  params: {
    appointmentId: string;
  };
};

type AppointmentDetailNavigationProp = StackNavigationProp<RootStackParamList, 'AppointmentDetail'>;

const STATUS_FLOW: AppointmentStatus[] = ['booked', 'confirmed', 'on_route', 'in_progress', 'completed', 'sale'];

export default function AppointmentDetailScreen() {
  const route = useRoute<AppointmentDetailRouteProp>();
  const navigation = useNavigation<AppointmentDetailNavigationProp>();
  const { appointmentId } = route.params;
  
  const [appointment, setAppointment] = useState<(Appointment & { contacts: Contact | null }) | null>(null);
  const [jobCard, setJobCard] = useState<JobCard | null>(null);
  const [jobCardImages, setJobCardImages] = useState<{ id: string; public_url: string; storage_path: string; caption: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchAppointment = useCallback(async () => {
    try {
      const { data, error } = await supabase
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
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      setAppointment(data);

      // Fetch associated job card if exists
      const { data: jcData } = await supabase
        .from('job_cards')
        .select('*')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      setJobCard(jcData);

      // Fetch job card images if job card exists
      if (jcData?.id) {
        const { data: imagesData } = await supabase
          .from('job_card_images')
          .select('id, public_url, storage_path, caption')
          .eq('job_card_id', jcData.id)
          .order('created_at', { ascending: false });
        setJobCardImages(imagesData || []);
      } else {
        setJobCardImages([]);
      }
    } catch (error) {
      console.error('Error fetching appointment:', error);
      Alert.alert('Error', 'Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    fetchAppointment();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`appointment-${appointmentId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'appointments',
          filter: `id=eq.${appointmentId}`
        },
        () => fetchAppointment()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [appointmentId, fetchAppointment]);

  const updateStatus = async (newStatus: AppointmentStatus) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      // Refresh data
      fetchAppointment();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const openMaps = () => {
    if (!appointment?.contacts?.address) {
      Alert.alert('No Address', 'No address available for this appointment');
      return;
    }

    const address = `${appointment.contacts.address}, ${appointment.contacts.city || ''}, ${appointment.contacts.state || ''}`;
    const encodedAddress = encodeURIComponent(address);
    
    // Try Google Maps first, fallback to Apple Maps on iOS
    const url = Platform.OS === 'ios' 
      ? `maps://?q=${encodedAddress}`
      : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
      }
    });
  };

  const makeCall = () => {
    const phone = appointment?.contacts?.phone_e164;
    if (!phone) {
      Alert.alert('No Phone', 'No phone number available');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const getCurrentStatusIndex = () => {
    const index = STATUS_FLOW.indexOf(appointment?.status as AppointmentStatus);
    if (index === -1) {
      console.warn("[AppointmentDetailScreen] Invalid status:", appointment?.status);
      return -1;
    }
    return index;
  };

  const getNextStatus = (): AppointmentStatus | null => {
    const currentIndex = getCurrentStatusIndex();
    if (currentIndex === -1) return null;
    if (currentIndex < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[currentIndex + 1];
    }
    return null;
  };

  const getStatusColor = (status: AppointmentStatus) => {
    const colors: Record<string, string> = {
      booked: '#007AFF',
      confirmed: '#34C759',
      rescheduled: '#FF9500',
      completed: '#8E8E93',
      no_show: '#FF3B30',
      replaced: '#8E8E93',
      on_route: '#007AFF',
      in_progress: '#FF9500',
      sale: '#34C759',
      cancelled: '#FF3B30',
    };
    return colors[status] || '#8E8E93';
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return formatAppDateTime(date);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Appointment not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nextStatus = getNextStatus();
  const contact = appointment.contacts;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
          <Text style={styles.statusText}>{appointment.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.section}>
        <Text style={styles.customerName}>
          {contact?.first_name} {contact?.last_name}
        </Text>
        <Text style={styles.dateTime}>{formatDateTime(appointment.appointment_at)}</Text>
        
        {contact?.phone_e164 && (
          <TouchableOpacity style={styles.actionButton} onPress={makeCall}>
            <Text style={styles.actionButtonText}>📞 Call Customer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Address</Text>
        <Text style={styles.address}>
          {contact?.address || appointment.address || 'No address provided'}
        </Text>
        {(contact?.city || appointment.city) && (
          <Text style={styles.address}>
            {contact?.city || appointment.city}, {contact?.state || appointment.state} {contact?.zip_code || appointment.zip_code}
          </Text>
        )}
        <TouchableOpacity style={styles.mapsButton} onPress={openMaps}>
          <Text style={styles.mapsButtonText}>🗺️ Open in Maps</Text>
        </TouchableOpacity>
      </View>

      {/* Status Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.progressContainer}>
          {STATUS_FLOW.map((status, index) => {
            const currentIndex = getCurrentStatusIndex();
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;
            
            return (
              <View key={status} style={styles.progressItem}>
                <View style={[
                  styles.progressDot,
                  isCompleted && styles.progressDotCompleted,
                  isCurrent && styles.progressDotCurrent
                ]} />
                <Text style={[
                  styles.progressLabel,
                  isCompleted && styles.progressLabelCompleted,
                  isCurrent && styles.progressLabelCurrent
                ]}>
                  {status.replace('_', ' ')}
                </Text>
                {index < STATUS_FLOW.length - 1 && (
                  <View style={[
                    styles.progressLine,
                    index < currentIndex && styles.progressLineCompleted
                  ]} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Status Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Update Status</Text>
        {updating ? (
          <ActivityIndicator color="#007AFF" />
        ) : nextStatus ? (
          <TouchableOpacity 
            style={[styles.statusButton, { backgroundColor: getStatusColor(nextStatus) }]}
            onPress={() => updateStatus(nextStatus)}
          >
            <Text style={styles.statusButtonText}>
              Mark as {nextStatus.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.completedText}>Appointment completed</Text>
        )}
        
        {appointment.status !== 'cancelled' && (
          <TouchableOpacity 
            style={[styles.statusButton, styles.cancelButton]}
            onPress={() => Alert.alert(
              'Cancel Appointment',
              'Are you sure you want to cancel this appointment?',
              [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', onPress: () => updateStatus('cancelled') }
              ]
            )}
          >
            <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notes */}
      {appointment.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{appointment.notes}</Text>
        </View>
      )}

      {/* Job Card Section (if sale or completed status) */}
      {(appointment.status === 'sale' || appointment.status === 'completed') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Card</Text>
          {jobCard ? (
            <>
              <Text style={styles.jobCardStatus}>Status: {jobCard.status}</Text>
              {jobCard.project_notes && (
                <Text style={styles.notes}>{jobCard.project_notes}</Text>
              )}
              {/* Photo Upload */}
              <ImageUpload
                jobCardId={jobCard.id}
                images={jobCardImages}
                onImagesUpdated={() => fetchAppointment()}
              />
            </>
          ) : (
            <Text style={styles.noJobCard}>Job card will be created automatically when marked as sale</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  address: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  notes: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: '#34C759',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapsButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  mapsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  progressDotCompleted: {
    backgroundColor: '#34C759',
  },
  progressDotCurrent: {
    backgroundColor: '#007AFF',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  progressLine: {
    position: 'absolute',
    top: 6,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#e0e0e0',
  },
  progressLineCompleted: {
    backgroundColor: '#34C759',
  },
  progressLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  progressLabelCompleted: {
    color: '#34C759',
  },
  progressLabelCurrent: {
    color: '#007AFF',
    fontWeight: '600',
  },
  statusButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  completedText: {
    textAlign: 'center',
    color: '#34C759',
    fontSize: 16,
    fontWeight: '600',
  },
  jobCardStatus: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  noJobCard: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
