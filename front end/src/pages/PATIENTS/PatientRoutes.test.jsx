import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PATIENT_PORTAL_OP_BILLS_KEY } from "../../utils/billingRevenue";
import { findPatientBookingConflict, PatientBillsPage } from "./PatientRoutes";

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

describe("PatientBillsPage", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    );
  });

  it("renders a download invoice action for the latest bill", async () => {
    render(
      <MemoryRouter>
        <PatientBillsPage
          bills={[
            {
              id: "bill-1",
              invoiceNumber: "INV-1001",
              patientName: "Ada Lovelace",
              totalAmount: 1200,
              status: "Pending",
            },
          ]}
          patient={{ id: "p-1", patientName: "Ada Lovelace" }}
          visits={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /download invoice/i })).toBeInTheDocument();
  });

  it("shows diagnostic bills saved from the reception billing flow", async () => {
    localStorage.setItem(
      PATIENT_PORTAL_OP_BILLS_KEY,
      JSON.stringify([
        {
          id: "diag-1",
          invoiceNo: "DT-1101",
          invoiceType: "diagnostic",
          billingType: "Lab",
          serviceType: "Diagnostic Billing",
          patientId: "p-1",
          patientName: "Ada Lovelace",
          totalAmount: 1500,
          status: "Paid",
          createdAt: "2026-08-01T10:00:00.000Z",
        },
      ])
    );

    render(
      <MemoryRouter>
        <PatientBillsPage
          bills={[]}
          patient={{ id: "p-1", patientName: "Ada Lovelace" }}
          visits={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText(/diagnostic/i)).toBeInTheDocument();
  });
});
