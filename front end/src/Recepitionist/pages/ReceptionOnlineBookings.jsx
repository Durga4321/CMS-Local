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

function ReceptionOnlineBookings() {
  return (
    <ReceptionAppointmentList
      title="Online Bookings"
      subtitle="Appointments booked through the patient portal or app."
      fetchAppointments={getAllAppointments}
      bookingType="Online"
      emptyState="No online bookings found for the current filters."
    />
  );
}

export default ReceptionOnlineBookings;
