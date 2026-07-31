import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import NurseLayout from "./NurseLayout";
import ReceptionDashboard from "../Recepitionist/pages/ReceptionDashboard";
import NursePatients from "./NursePatients";
import NurseAppointments from "./NurseAppointments";
import ReceptionBilling from "../Recepitionist/pages/ReceptionBilling";
import NurseMedicalHistory from "./NurseMedicalHistory";
import NurseOnlineBookings from "./NurseOnlineBookings";
import NurseOfflineBookings from "./NurseOfflineBookings";
import UserProfilePage from "../profile/UserProfilePage";
import ConsultantRoomDisplay from "../components/ConsultantRoomDisplay";
import { requestJson as nurseRequestJson } from "../Recepitionist/receptionApi";
import { getNurseScope, scopeNurseRecords } from "./nurseScope";

function NurseApp() {
  return (
    <Routes>
      <Route element={<NurseLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <ReceptionDashboard
              hideActions
              hideCards
              title="Nurse Dashboard"
              apiRequest={nurseRequestJson}
              getScope={getNurseScope}
              scopeRecords={scopeNurseRecords}
            />
          }
        />
        <Route path="patients" element={<NursePatients />} />
        <Route path="medical-history" element={<NurseMedicalHistory />} />
        <Route path="appointments" element={<NurseAppointments />} />
        <Route path="appointments/online" element={<NurseOnlineBookings />} />
        <Route path="appointments/offline" element={<NurseOfflineBookings />} />
        <Route path="consultant-room" element={<ConsultantRoomDisplay audience="nurse" />} />
        <Route path="billing" element={<ReceptionBilling />} />
        <Route path="profile" element={<UserProfilePage roleType="nurse" />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default NurseApp;
