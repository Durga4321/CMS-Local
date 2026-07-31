import React, { useEffect, useMemo, useState } from "react";
import ReceptionAppointmentList from "../Recepitionist/pages/ReceptionAppointmentList";
import { getOfflineAppointments, getOnlineAppointments, requestJson as nurseRequestJson } from "../Recepitionist/receptionApi";
import { getNurseScope } from "./nurseScope";

function NurseOfflineBookings() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "appointments:updatedAt") {
        setRefreshKey((k) => k + 1);
      }
    };
    const onFocus = () => setRefreshKey((k) => k + 1);

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const fetchAppointments = useMemo(() => {
    // create a new function instance whenever refreshKey changes so the
    // ReceptionAppointmentList effect re-runs and reloads data
    return async () => {
      const [onlineAppointments, offlineAppointments] = await Promise.all([
        getOnlineAppointments(),
        getOfflineAppointments(),
      ]);

      return [...onlineAppointments, ...offlineAppointments];
    };
  }, [refreshKey]);

  return (
    <ReceptionAppointmentList
      title="Offline Bookings"
      subtitle="Appointments created manually by the receptionist."
      fetchAppointments={fetchAppointments}
      bookingType="Offline"
      emptyState="No offline bookings found for the current filters."
      apiRequest={nurseRequestJson}
      getScope={getNurseScope}
      scopeRecords={(records) => records}
    />
  );
}

export default NurseOfflineBookings;
