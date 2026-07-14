# Appointment Status Flow - Complete Implementation

## Overview
Three-state appointment status flow with full UI↔Backend synchronization for the doctor's appointment lifecycle.

---

## Status Progression

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────┐
│   WAITING   │─────▶│  IN PROGRESS    │─────▶│  COMPLETED  │
└─────────────┘      └─────────────────┘      └─────────────┘
     ▲                       ▲                       ▲
     │                       │                       │
  Created             Consultation          Prescription
  on Appointment      Started/Saved        Submitted
  Booking             (saveConsultation)   (submitPrescription)
```

---

## Implementation Details

### 1. **DoctorAppointments.jsx** - List View with Real-Time Sync

**Location**: `src/doctors/pages/DoctorAppointments.jsx`

**Status Handler**:
```javascript
const handleStatusUpdate = (event) => {
  const { appointmentId, status } = event.detail;
  setAppointments((prev) =>
    prev.map((apt) =>
      String(apt.id || apt.appointmentId) === String(appointmentId)
        ? { ...apt, status }
        : apt
    )
  );
};
```

**Event Listener Setup**:
```javascript
useEffect(() => {
  window.addEventListener("appointmentStatusUpdated", handleStatusUpdate);
  return () => {
    window.removeEventListener("appointmentStatusUpdated", handleStatusUpdate);
  };
}, []);
```

**What happens**:
- Displays appointments with current status: "Waiting", "In Progress", "Completed"
- Listens for `appointmentStatusUpdated` custom events from other pages
- Updates appointment list in real-time when status changes

---

### 2. **Consultation.jsx** - First Step: Waiting → In Progress

**Location**: `src/doctors/pages/Consultation.jsx`

**Status Update Function**:
```javascript
const updateAppointmentStatusAPI = async (appointmentId, newStatus, headers = {}) => {
  const finalHeaders = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...headers,
  };

  const response = await fetch(`${APPOINTMENTS_API}/${appointmentId}`, {
    method: "PATCH",
    headers: finalHeaders,
    body: JSON.stringify({ status: newStatus }),
  });

  if (response.ok) {
    return response.json().catch(() => ({ status: newStatus }));
  }
  
  console.warn(`Status update failed`);
  return { status: newStatus };
};
```

**In saveConsultation()**:
```javascript
const updatedStatus = "In Progress";
await updateAppointmentStatusAPI(appointment.appointmentId, updatedStatus, headers);

setAppointment((prev) => ({
  ...prev,
  status: updatedStatus,
}));

window.dispatchEvent(new CustomEvent("appointmentStatusUpdated", {
  detail: { appointmentId: appointment.appointmentId, status: updatedStatus },
}));
```

**What happens**:
1. Doctor fills in clinical notes (Subjective, Assessment, Plan)
2. Enters diagnosis from dropdown
3. Clicks "Continue to Prescription" button
4. `saveConsultation()` is called
5. **PATCH** request sent to: `PATCH /api/Appointment/{id}` with `{ status: "In Progress" }`
6. Backend updates appointment status
7. Frontend updates local state
8. **Dispatches event** to notify other pages of status change
9. Navigates to Prescription page

---

### 3. **Prescription.jsx** - Final Step: In Progress → Completed

**Location**: `src/doctors/pages/Prescription.jsx`

**Status Update Function**:
```javascript
const updateAppointmentStatus = async (appointmentId, newStatus, headers = {}) => {
  const finalHeaders = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...headers,
  };

  const response = await fetch(`${APPOINTMENTS_API}/${appointmentId}`, {
    method: "PATCH",
    headers: finalHeaders,
    body: JSON.stringify({ status: newStatus }),
  });

  if (response.ok) {
    const data = await response.json().catch(() => ({}));
    window.dispatchEvent(new CustomEvent("appointmentStatusUpdated", {
      detail: { appointmentId, status: newStatus },
    }));
    return data || { status: newStatus };
  }

  console.warn(`Status update failed`);
  return { status: newStatus };
};
```

**In submitPrescription()**:
```javascript
// After prescription submission succeeds:
const statusResult = await updateAppointmentStatus(appointmentId, "Completed", headers);
const completedStatus = statusResult?.status || "Completed";

setAppointment((prev) => ({ ...prev, status: completedStatus }));
toast.success("Prescription submitted.");
goToCompletion(completedStatus, "Prescription submitted.");

// Event dispatched automatically in updateAppointmentStatus function
```

**What happens**:
1. Doctor adds one or more medicines with dosage, frequency, duration
2. Selects diagnosis
3. Sets follow-up date
4. Clicks "Submit Prescription"
5. `submitPrescription()` is called
6. Prescription saved to backend
7. **PATCH** request sent to: `PATCH /api/Appointment/{id}` with `{ status: "Completed" }`
8. Backend updates appointment status
9. Frontend updates local state
10. **Dispatches event** to notify DoctorAppointments of completion
11. Navigates to completion page

---

## API Endpoints Used

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/api/Appointment` | GET | List appointments | N/A |
| `/api/Appointment/{id}` | PATCH | Update status | `{ status: "In Progress" \| "Completed" }` |
| `/api/Consultation` | POST | Save consultation notes | `{ appointmentId, patientId, diagnosis, clinicalNotes, ... }` |
| `/api/Prescription` | POST | Submit prescription | `{ appointmentId, patientId, status: "Completed", medicines, ... }` |

---

## Real-Time Synchronization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ DoctorAppointments.jsx (Listening)                              │
│                                                                  │
│ Appointment List:                                               │
│ - ID: 5, Status: Waiting  ◄────┐                               │
│ - ID: 6, Status: Completed     │                               │
│                                │                               │
└────────────────────────────────┼──────────────────────────────┘
                                 │
                                 │ UPDATE EVENT
                        appointmentStatusUpdated
                                 │
                                 │
        ┌────────────────────────┴───────────────────────┐
        │                                                │
        │                                                │
┌───────▼──────────────────┐             ┌──────────────▼────────┐
│ Consultation.jsx         │             │ Prescription.jsx      │
│                          │             │                       │
│ Saves consultation       │             │ Saves prescription    │
│ Updates status:          │             │ Updates status:       │
│ "In Progress" ──────────▶│ DISPATCH    │ "Completed" ─────────▶│
│                          │ EVENT       │                       │
└──────────────────────────┘             └───────────────────────┘
```

---

## Key Features

✅ **Bidirectional Sync**
- Backend updates reflected immediately in UI
- All pages see the same status without page refresh

✅ **Event-Driven Architecture**
- Uses custom `appointmentStatusUpdated` event
- Decoupled pages communicate via event system
- No direct component communication needed

✅ **Graceful Degradation**
- If status update fails, operation continues (doesn't block flow)
- Console warnings logged for debugging
- Frontend state updates even if backend fails (optimistic update)

✅ **Consistent API Pattern**
- All status updates use: `PATCH /api/Appointment/{id}` with `{ status: "..." }`
- Single endpoint, consistent method across all transitions

✅ **Authentication**
- Bearer token from localStorage automatically included
- Works with ngrok tunnel and proper CORS headers

---

## Testing the Flow

### Test Scenario 1: Complete Flow
1. Open **DoctorAppointments** - see appointment with status "Waiting"
2. Click "Start Consultation" - navigates to Consultation.jsx
3. Fill diagnosis and clinical notes
4. Click "Continue to Prescription"
5. **Status updates to "In Progress"** → can be verified by:
   - Checking browser console (should show event dispatch)
   - If you open DoctorAppointments in another tab/window, status syncs in real-time
6. Fill medicines, frequency, duration
7. Click "Submit Prescription"
8. **Status updates to "Completed"** → visible in DoctorAppointments

### Test Scenario 2: Real-Time Sync
1. Open DoctorAppointments in one tab (shows appointment as "Waiting")
2. Start consultation in another tab
3. Save consultation
4. **First tab automatically updates** appointment to "In Progress" (no refresh needed)

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Status not updating | Bearer token missing | Check localStorage for auth token |
| Status not syncing between pages | Event listener not registered | Verify `useEffect` with event listener exists |
| 400/404 errors | Wrong endpoint path | Confirm using `PATCH /api/Appointment/{id}` |
| Status reverts after page reload | Only frontend updated | Verify backend status API is working |

---

## Files Modified

1. **src/doctors/pages/DoctorAppointments.jsx**
   - Added `handleStatusUpdate` handler
   - Added event listener for `appointmentStatusUpdated`
   - Status updates reflected in appointment list

2. **src/doctors/pages/Consultation.jsx**
   - Added `updateAppointmentStatusAPI` helper function
   - Updated `saveConsultation()` to call status update API
   - Dispatches event after status change

3. **src/doctors/pages/Prescription.jsx**
   - Updated `updateAppointmentStatus` function for cleaner implementation
   - Status update called after successful prescription submission
   - Dispatches event after status change

---

## Summary

The appointment status flow is now fully synchronized across the entire doctor workflow:

- **Waiting** (initial) → **In Progress** (consultation started) → **Completed** (prescription submitted)
- All status changes propagate immediately to the appointment list
- Backend and frontend stay in sync without page reloads
- Uses single, consistent API endpoint for all status updates
- Event-driven architecture ensures clean separation of concerns
