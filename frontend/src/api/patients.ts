import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePatientInput } from "@diacify/shared";

import { apiFetch } from "../lib/apiClient";
import type { RiskAssessment } from "./visits";

export type { CreatePatientInput };

export type PatientSex = "male" | "female";

export interface Patient {
  id: string;
  reference: string;
  sex: PatientSex;
  created_at: string;
}

/**
 * A patient as GET /api/patients (the list) returns it — richer than a
 * plain Patient (GET /api/patients/:id) because only the list route embeds
 * a visit count and the latest visit's latest assessment. Kept as its own
 * type rather than making those fields optional on Patient everywhere,
 * since they are always present on a list row and never present on a
 * single-patient fetch.
 */
export interface PatientListItem extends Patient {
  visit_count: number;
  /** The latest visit's date, or null if there are no visits yet. */
  last_visit_date: string | null;
  /** The latest visit's latest assessment, or null if unscored/no visits yet. */
  risk_assessment: RiskAssessment | null;
}

interface PatientListResponse {
  data: PatientListItem[];
  page: number;
  limit: number;
  total: number;
}

// The list's risk filter/sort/counts (see PatientListPage) run entirely in
// the browser over this one fetched page, not against the server — there
// is no backend sort-by-risk or filter-by-category yet (that needs a new
// Postgres view; context/tasks.md tracks it). Fetching the backend's own
// max page size is the honest way to make that correct for a solo
// clinician's realistic patient count; past 100 patients the list and its
// filter counts would only reflect the first 100, newest first.
const LIST_ALL_LIMIT = 100;

/** Exported so other mutations (e.g. recording a visit) that change what
 *  this list shows for a patient can invalidate it without redeclaring
 *  the same literal key. */
export const PATIENTS_QUERY_KEY = ["patients"] as const;

/** Fetches the caller's own patients, newest first, up to LIST_ALL_LIMIT of them. */
export function usePatients() {
  return useQuery({
    queryKey: PATIENTS_QUERY_KEY,
    queryFn: () => apiFetch<PatientListResponse>(`/api/patients?limit=${LIST_ALL_LIMIT}`),
  });
}

/** Fetches one patient by id. */
export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: () => apiFetch<{ data: Patient }>(`/api/patients/${id}`),
  });
}

/** Creates a patient and refreshes the patient list on success. */
export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePatientInput) =>
      apiFetch<{ data: Patient }>("/api/patients", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
  });
}

/** Edits a patient's reference/sex and refreshes both the list and its own cache entry. */
export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePatientInput) =>
      apiFetch<{ data: Patient }>(`/api/patients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["patients", id] });
    },
  });
}

/**
 * Permanently deletes a patient and everything on their chart — the
 * backend cascades away their visits and risk assessments with them. There
 * is no undo.
 */
export function useDeletePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/patients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
  });
}
