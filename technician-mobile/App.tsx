import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';

// Screens
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import ManagerDashboardScreen from './screens/ManagerDashboardScreen';
import AppointmentDetailScreen from './screens/AppointmentDetailScreen';
import AvailabilityScreen from './screens/AvailabilityScreen';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  ManagerDashboard: undefined;
  AppointmentDetail: { appointmentId: string };
  Availability: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isManager, setIsManager] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Check user role when session changes
  useEffect(() => {
    const checkUserRole = async () => {
      if (!session?.user) {
        setIsManager(null);
        setLoading(false);
        return;
      }

      try {
        // Check if user is manager, admin, or supervisor
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .in('role', ['admin', 'manager', 'supervisor']);
        
        setIsManager(roles && roles.length > 0);
      } catch (error) {
        console.error('Error checking role:', error);
        setIsManager(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, [session]);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session && session.user ? (
          isManager ? (
            // Manager flow
            <>
              <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
              <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
            </>
          ) : (
            // Technician flow
            <>
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
              <Stack.Screen name="Availability" component={AvailabilityScreen} />
            </>
          )
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
