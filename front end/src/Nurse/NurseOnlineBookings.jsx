import React from "react";
import ReceptionAppointmentList from "../Recepitionist/pages/ReceptionAppointmentList";
import { getOfflineAppointments, getOnlineAppointments, requestJson as nurseRequestJson } from "../Recepitionist/receptionApi";
import { getNurseScope, scopeNurseRecords } from "./nurseScope";

const getAllAppointments = async () => {
  const [onlineAppointments, offlineAppointments] = await Promise.all([
    getOnlineAppointments(),
    getOfflineAppointments(),
  ]);

  return scopeNurseRecords([...onlineAppointments, ...offlineAppointments]);
};

function NurseOnlineBookings() {
  return (
    <ReceptionAppointmentList
      title="Online Bookings"
      subtitle="Appointments booked through the patient portal or app."
      fetchAppointments={getAllAppointments}
      bookingType="Online"
      emptyState="No online bookings found for the current filters."
      apiRequest={nurseRequestJson}
      getScope={getNurseScope}
      scopeRecords={scopeNurseRecords}
    />
  );
}

export default NurseOnlineBookings;
