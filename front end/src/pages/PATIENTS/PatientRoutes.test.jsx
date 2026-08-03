import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
});
