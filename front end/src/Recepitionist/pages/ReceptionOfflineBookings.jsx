import React from "react";
import ReceptionAppointmentList from "./ReceptionAppointmentList";
import { getOfflineAppointments, getOnlineAppointments } from "../receptionApi";

const getAllAppointments = async () => {
  const [onlineAppointments, offlineAppointments] = await Promise.all([
    getOnlineAppointments(),
    getOfflineAppointments(),
  ]);

  return [...onlineAppointments, ...offlineAppointments];
};

function ReceptionOfflineBookings() {
  return (
    <ReceptionAppointmentList
      title="Offline Bookings"
      subtitle="Appointments created manually by the receptionist."
      fetchAppointments={getAllAppointments}
      bookingType="Offline"
      emptyState="No offline bookings found for the current filters."
    />
  );
}

export default ReceptionOfflineBookings;
