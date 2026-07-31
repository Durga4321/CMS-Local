import React from "react";
import ReceptionMedicalHistory from "../Recepitionist/pages/ReceptionMedicalHistory";
import { nursePatientsRequestJson } from "./NursePatients";
import { getNurseScope } from "./nurseScope";

function NurseMedicalHistory() {
  return (
    <ReceptionMedicalHistory
      basePath="/nurse"
      apiRequest={nursePatientsRequestJson}
      getScope={getNurseScope}
      scopeRecords={(records) => records}
    />
  );
}

export default NurseMedicalHistory;
