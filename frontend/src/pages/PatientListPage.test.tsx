import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PatientListPage } from "./PatientListPage";
import { ApiError } from "../lib/apiClient";
import * as patientsApi from "../api/patients";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const PATIENT = {
  id: "p1",
  reference: "Chart 12",
  sex: "female" as const,
  created_at: "2026-09-01T10:00:00.000Z",
};

describe("PatientListPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a blank prompt when the clinician has no patients yet", async () => {
    vi.spyOn(patientsApi, "usePatients").mockReturnValue({
      data: { data: [], page: 1, limit: 20, total: 0 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof patientsApi.usePatients>);
    vi.spyOn(patientsApi, "useCreatePatient").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof patientsApi.useCreatePatient>);

    renderWithClient(<PatientListPage />);

    expect(await screen.findByText(/no patients yet/i)).toBeInTheDocument();
  });

  it("lists each patient's reference and created date as a tab", async () => {
    vi.spyOn(patientsApi, "usePatients").mockReturnValue({
      data: { data: [PATIENT], page: 1, limit: 20, total: 1 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof patientsApi.usePatients>);
    vi.spyOn(patientsApi, "useCreatePatient").mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof patientsApi.useCreatePatient>);

    renderWithClient(<PatientListPage />);

    expect(await screen.findByText("Chart 12")).toBeInTheDocument();
  });

  it("submits the new-chart form and shows a duplicate-reference error inline", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError(409, "Reference already in use"));
    vi.spyOn(patientsApi, "usePatients").mockReturnValue({
      data: { data: [], page: 1, limit: 20, total: 0 },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof patientsApi.usePatients>);
    vi.spyOn(patientsApi, "useCreatePatient").mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof patientsApi.useCreatePatient>);

    renderWithClient(<PatientListPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /new chart/i }));
    const form = await screen.findByRole("form", { name: /new chart/i });
    await user.type(within(form).getByLabelText(/reference/i), "Chart 1");
    await user.click(within(form).getByRole("radio", { name: /female/i }));
    await user.click(within(form).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ reference: "Chart 1", sex: "female" }));
    expect(await screen.findByText("Reference already in use")).toBeInTheDocument();
  });
});
