import { filterAppointments, getBookingType } from "./appointmentListUtils";

describe("appointment list utilities", () => {
  it("returns the correct booking type from common payload shapes", () => {
    expect(getBookingType({ bookingType: "Online" })).toBe("Online");
    expect(getBookingType({ BookingType: "offline" })).toBe("Offline");
    expect(getBookingType({ type: "Unknown" })).toBe("Unknown");
  });

  it("filters appointments by search, doctor, status, and date", () => {
    const appointments = [
      {
        id: 1,
        tokenNumber: "1001",
        patientCode: "P001",
        patientName: "Asha Rao",
        doctorName: "Dr. Anil",
        status: "Pending",
        date: "2026-07-15",
      },
      {
        id: 2,
        tokenNumber: "1002",
        patientCode: "P002",
        patientName: "John Doe",
        doctorName: "Dr. Meera",
        status: "Confirmed",
        date: "2026-07-16",
      },
    ];

    const result = filterAppointments(appointments, {
      search: "asha",
      doctor: "Dr. Anil",
      status: "Pending",
      date: "2026-07-15",
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});
