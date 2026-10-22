import React from "react";
import ReceptionAppointments from "../Recepitionist/pages/ReceptionAppointments";
import { requestJson as nurseRequestJson } from "./nurseApi";
import { getNurseScope, scopeNurseRecords } from "./nurseScope";

function NurseAppointments() {
  return <ReceptionAppointments hideActions apiRequest={nurseRequestJson} getScope={getNurseScope} scopeRecords={scopeNurseRecords} />;
}

export default NurseAppointments;
