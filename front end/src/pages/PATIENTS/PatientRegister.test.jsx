import { validateDobValue } from "./PatientRegister";

describe("PatientRegister DOB validation", () => {
  it("rejects unrealistic dates older than maximum allowed age", () => {
    const error = validateDobValue("01/01/1885");
    expect(error).toBe("Enter a realistic date of birth. Age must be 100 years or less.");
  });
});
