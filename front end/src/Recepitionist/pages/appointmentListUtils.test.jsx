import { applyTimeOrderedTokens, dedupeSameDayAppointments, filterAppointments, getBookingType } from "./appointmentListUtils";

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

  it("assigns display tokens by appointment time across online and offline bookings", () => {
    const appointments = applyTimeOrderedTokens([
      { id: 1, bookingType: "Online", date: "2026-07-28", startTime: "09:15 AM" },
      { id: 2, bookingType: "Offline", date: "2026-07-28", startTime: "09:00 AM" },
      { id: 3, bookingType: "Online", date: "2026-07-28", startTime: "06:00 PM" },
      { id: 4, bookingType: "Offline", date: "2026-07-29", startTime: "09:00 AM" },
    ]);

    expect(appointments.find((item) => item.id === 2).displayTokenNumber).toBe("TKN001");
    expect(appointments.find((item) => item.id === 1).displayTokenNumber).toBe("TKN002");
    expect(appointments.find((item) => item.id === 3).displayTokenNumber).toBe("TKN003");
    expect(appointments.find((item) => item.id === 4).displayTokenNumber).toBe("TKN001");
  });

  it("deduplicates same patient same-day appointments across merged records", () => {
    const rawAppointments = [
      { appointmentId: "A1", patientId: "P1", doctorId: "D1", date: "2026-08-10", bookingType: "Offline" },
      { appointmentId: "A1", patientId: "P1", doctorId: "D1", date: "2026-08-10", bookingType: "Offline" },
      { patientId: "P2", doctorId: "D1", date: "2026-08-10", bookingType: "Online" },
      { patientId: "P2", doctorId: "D1", date: "2026-08-11", bookingType: "Online" },
      { patientId: "P3", doctorId: "D2", date: "2026-08-10", bookingType: "Online" },
      { patientId: "P3", doctorId: "D2", date: "2026-08-10", bookingType: "Online" },
    ];

    const result = dedupeSameDayAppointments(rawAppointments);

    expect(result).toHaveLength(4);
    expect(result.map((item) => item.patientId)).toEqual(["P1", "P2", "P2", "P3"]);
    expect(result.some((item) => item.date === "2026-08-11")).toBe(true);
  });
});
