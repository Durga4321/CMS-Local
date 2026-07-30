import { findPatientBookingConflict } from "./PatientRoutes";

describe("findPatientBookingConflict", () => {
  it("blocks a new booking when the patient already has an active appointment", () => {
    const visits = [
      {
        id: "apt-1",
        status: "Scheduled",
        date: "2026-08-01",
        startTime: "10:00",
      },
    ];

    expect(findPatientBookingConflict(visits, "2026-08-02", "11:00")).toEqual(visits[0]);
  });
});
