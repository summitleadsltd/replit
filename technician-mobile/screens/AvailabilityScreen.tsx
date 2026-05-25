import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Switch
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, shadows, spacing, borderRadius } from '../lib/theme';

interface AvailabilityDay {
  id: string;
  date: string;
  is_available: boolean;
  notes: string | null;
}

export default function AvailabilityScreen() {
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [editIsAvailable, setEditIsAvailable] = useState(true);

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
      if (!user) return;

      // Get technician ID
      const { data: techData } = await supabase
        .from('technicians')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!techData) {
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
        };
      });

      setAvailability(fullAvailability);
    } catch (error) {
      console.error('Error fetching availability:', error);
      Alert.alert('Error', 'Failed to load availability');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [next30Days]);

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
    setShowEditModal(true);
  };

  const saveAvailability = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !selectedDate) return;

      const { data: techData } = await supabase
        .from('technicians')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!techData) {
        Alert.alert('Error', 'Technician profile not found');
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
        }, {
          onConflict: 'technician_id,date'
        });

      if (error) throw error;

      Alert.alert('Success', 'Availability updated');
      setShowEditModal(false);
      fetchAvailability();
    } catch (error) {
      console.error('Error saving availability:', error);
      Alert.alert('Error', 'Failed to save availability');
    }
  };

  const formatDate = (dateString: string) => {
    // Parse as local date by splitting the ISO string
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      isToday,
    };
  };

  const getDayOfWeek = (dateString: string) => {
    // Parse as local date by splitting the ISO string
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDay(); // 0 = Sunday, 6 = Saturday
  };

  const isWeekend = (dateString: string) => {
    const day = getDayOfWeek(dateString);
    return day === 0 || day === 6;
  };

  const renderDay = (day: AvailabilityDay) => {
    const formatted = formatDate(day.date);
    const weekend = isWeekend(day.date);

    return (
      <TouchableOpacity
        key={day.date}
        style={[
          styles.dayCard,
          day.is_available ? styles.availableCard : styles.unavailableCard,
          weekend && styles.weekendCard,
          formatted.isToday && styles.todayCard,
        ]}
        onPress={() => openEditModal(day)}
      >
        <View style={styles.dateSection}>
          <Text style={[styles.dayName, formatted.isToday && styles.todayText]}>
            {formatted.isToday ? 'Today' : formatted.dayName}
          </Text>
          <Text style={[styles.dayNumber, formatted.isToday && styles.todayText]}>
            {formatted.dayNumber}
          </Text>
          <Text style={styles.month}>{formatted.month}</Text>
        </View>

        <View style={styles.statusSection}>
          <View style={[
            styles.statusBadge,
            day.is_available ? styles.availableBadge : styles.unavailableBadge
          ]}>
            <Text style={[
              styles.statusText,
              day.is_available ? styles.availableText : styles.unavailableText
            ]}>
              {day.is_available ? 'Available' : 'Unavailable'}
            </Text>
          </View>
          {day.notes && (
            <Text style={styles.notes} numberOfLines={1}>{day.notes}</Text>
          )}
        </View>

        <View style={styles.editIcon}>
          <Text style={styles.editText}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Availability</Text>
        <Text style={styles.subtitle}>Tap a day to update your availability</Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.availableDot]} />
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.unavailableDot]} />
          <Text style={styles.legendText}>Unavailable</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.weekendDot]} />
          <Text style={styles.legendText}>Weekend</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.daysContainer}>
          {availability.map(renderDay)}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedDate ? formatDate(selectedDate).dayName + ', ' + formatDate(selectedDate).month + ' ' + formatDate(selectedDate).dayNumber : ''}
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Available for appointments</Text>
              <Switch
                value={editIsAvailable}
                onValueChange={setEditIsAvailable}
                trackColor={{ false: '#767577', true: '#34C759' }}
                thumbColor="#fff"
              />
            </View>

            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={editNote}
              onChangeText={setEditNote}
              placeholder="e.g., Vacation, Half day, etc."
              multiline
              maxLength={100}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveAvailability}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  availableDot: {
    backgroundColor: '#34C759',
  },
  unavailableDot: {
    backgroundColor: '#FF3B30',
  },
  weekendDot: {
    backgroundColor: '#FF9500',
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  scrollContent: {
    padding: 12,
  },
  daysContainer: {
    gap: 8,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  availableCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  unavailableCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    opacity: 0.8,
  },
  weekendCard: {
    backgroundColor: '#FFF8E1',
  },
  todayCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  dateSection: {
    alignItems: 'center',
    width: 60,
  },
  dayName: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  month: {
    fontSize: 12,
    color: '#666',
  },
  todayText: {
    color: '#007AFF',
  },
  statusSection: {
    flex: 1,
    marginLeft: 16,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  availableBadge: {
    backgroundColor: '#E8F5E9',
  },
  unavailableBadge: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  availableText: {
    color: '#34C759',
  },
  unavailableText: {
    color: '#FF3B30',
  },
  notes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  editIcon: {
    width: 30,
    alignItems: 'center',
  },
  editText: {
    fontSize: 24,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  noteInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
