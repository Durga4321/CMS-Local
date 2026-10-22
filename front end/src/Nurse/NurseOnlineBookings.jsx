import React from "react";
import ReceptionAppointmentList from "../Recepitionist/pages/ReceptionAppointmentList";
import { getNurseAppointments, requestJson as nurseRequestJson } from "./nurseApi";
import { getNurseScope, scopeNurseRecords } from "./nurseScope";

const getAllAppointments = async () => {
  return scopeNurseRecords(await getNurseAppointments());
};

function NurseOnlineBookings() {
  return (
    <div className="nurse-online-bookings">
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
    </div>
  );
}

export default NurseOnlineBookings;
