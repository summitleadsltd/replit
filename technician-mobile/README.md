# Technician Mobile App

React Native (Expo) mobile app for field technicians to manage appointments.

## Features

- **Authentication**: Login with existing CRM credentials
- **Dashboard**: View today's appointments with real-time sync
- **Status Updates**: Update appointment status (booked → on_route → in_progress → completed/sale)
- **Job Cards**: Automatic creation when status changes to 'sale'
- **Maps Integration**: Open addresses in Google Maps / Apple Maps
- **Calls**: Tap to call customers

## Setup

1. **Install dependencies**:
   ```bash
   cd technician-mobile
   npm install
   ```

2. **Environment variables**:
   Copy `.env.example` to `.env` and add your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_ANON_KEY=
   ```

3. **Start the app**:
   ```bash
   npx expo start
   ```

## Build for Testing

### Android (APK)
```bash
eas build --platform android --profile preview
```

### iOS (Simulator)
```bash
eas build --platform ios --profile preview
```

## Build for Production

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

## Database Schema

The app uses the existing CRM database with these tables:
- `technicians` - Technician profiles
- `appointments` - Appointments with technician assignments
- `contacts` - Customer information
- `job_cards` - Job documentation created when appointment status changes to `sale`
- `technician_availability` - Technician scheduling
- `appointment_status_history` - Audit trail for status changes
- `job_card_images` - Media gallery for job cards

### Job Card Statuses
- `pending` - Initial creation
- `in_progress` - Work started
- `completed` - Work finished
- `sale` - Converted to sale
- `cancelled` - Cancelled

## Status Flow

Appointments follow this status progression:
1. `booked` - Initial booking
2. `confirmed` - Confirmed with customer
3. `on_route` - Technician en route
4. `in_progress` - Work started
5. `completed` - Work finished
6. `sale` - Sale made (triggers job card creation)

Alternative endings:
- `cancelled` - Appointment cancelled
- `no_show` - Customer didn't show
- `rescheduled` - Moved to new time

## Architecture

- **Stack Navigator**: Login → Dashboard → Appointment Detail
- **Supabase Realtime**: Live updates when appointments change
- **React Native**: Cross-platform mobile development
- **Expo**: Managed workflow for easier deployment
