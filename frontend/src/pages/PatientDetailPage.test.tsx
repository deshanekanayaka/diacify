import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PatientDetailPage } from "./PatientDetailPage";
import * as patientsApi from "../api/patients";
import * as visitsApi from "../api/visits";
import type { Visit } from "../api/visits";

function renderDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/patients/p1"]}>
        <Routes>
          <Route path="/patients/:id" element={<PatientDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const PATIENT = { id: "p1", reference: "Chart 12", sex: "female" as const, created_at: "2026-09-01T10:00:00Z" };

const SCORED_VISIT: Visit = {
  id: "v1",
  patient_id: "p1",
  visit_date: "2026-09-01",
  age: 50,
  systolic: 130,
  diastolic: 85,
  bmi: 27,
  hba1c: 6.1,
  rbs: null,
  cholesterol: null,
  triglycerides: null,
  hdl: null,
  ldl: null,
  vldl: null,
  created_at: "2026-09-01T10:00:00Z",
  risk_assessment: {
    model_version: "v1",
    risk_score: 62.5,
    risk_category: "medium",
    low_confidence: false,
    created_at: "2026-09-01T10:00:00Z",
  },
};

describe("PatientDetailPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(patientsApi, "usePatient").mockReturnValue({
      data: { data: PATIENT },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof patientsApi.usePatient>);
  });

  it("lands on History by default and lists past visits", async () => {
    vi.spyOn(visitsApi, "useVisits").mockReturnValue({
      data: { data: [SCORED_VISIT], page: 1, limit: 20, total: 1 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof visitsApi.useVisits>);

    renderDetail();

    expect(await screen.findByText("Chart 12")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("expands a visit row in place to show its full vitals", async () => {
    vi.spyOn(visitsApi, "useVisits").mockReturnValue({
      data: { data: [SCORED_VISIT], page: 1, limit: 20, total: 1 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof visitsApi.useVisits>);

    renderDetail();
    const user = userEvent.setup();

    expect(screen.queryByText("Systolic BP")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { expanded: false }));
    expect(screen.getByText("Systolic BP")).toBeInTheDocument();
  });

  it("switches to New Visit and shows the risk result after submitting", async () => {
    vi.spyOn(visitsApi, "useVisits").mockReturnValue({
      data: { data: [], page: 1, limit: 20, total: 0 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof visitsApi.useVisits>);
    const mutateAsync = vi.fn().mockResolvedValue({ data: SCORED_VISIT });
    vi.spyOn(visitsApi, "useCreateVisit").mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof visitsApi.useCreateVisit>);

    renderDetail();
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: "New Visit" }));
    const form = screen.getByRole("form", { name: /record visit/i });
    await user.type(within(form).getByLabelText(/^Age/), "50");
    await user.type(within(form).getByLabelText(/Systolic/), "130");
    await user.type(within(form).getByLabelText(/Diastolic/), "85");
    await user.type(within(form).getByLabelText(/^BMI/), "27");
    await user.type(within(form).getByLabelText(/HbA1c/), "6.1");
    await user.click(within(form).getByRole("button", { name: /record visit/i }));

    expect(await screen.findByText("medium risk")).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledWith({ age: 50, systolic: 130, diastolic: 85, bmi: 27, hba1c: 6.1 });
  });
});
