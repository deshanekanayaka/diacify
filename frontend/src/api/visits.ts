import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "../lib/apiClient";
import { PATIENTS_QUERY_KEY } from "./patients";

// Matches usePatients' own limit in api/patients.ts - the patient list's
// visit_count/last_visit_date/risk_assessment are the same "current risk"
// shape as this page's own data, so a visit history should reflect the
// same realistic-scale ceiling rather than silently truncating differently.
const VISIT_HISTORY_LIMIT = 100;

export type RiskCategory = "low" | "medium" | "high";

export interface RiskAssessment {
  model_version: string;
  risk_score: number;
  risk_category: RiskCategory;
  low_confidence: boolean;
  created_at: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  visit_date: string;
  age: number;
  systolic: number;
  diastolic: number;
  bmi: number;
  hba1c: number;
  rbs: number | null;
  cholesterol: number | null;
  triglycerides: number | null;
  hdl: number | null;
  ldl: number | null;
  vldl: number | null;
  created_at: string;
  risk_assessment: RiskAssessment | null;
}

interface VisitListResponse {
  data: Visit[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateVisitInput {
  /** Omitted means "today" — the backend column defaults to the current date. */
  visit_date?: string;
  age: number;
  systolic: number;
  diastolic: number;
  bmi: number;
  hba1c: number;
  rbs?: number;
  cholesterol?: number;
  triglycerides?: number;
  hdl?: number;
  ldl?: number;
  vldl?: number;
}

function visitsQueryKey(patientId: string) {
  return ["patients", patientId, "visits"] as const;
}

/**
 * Fetches a patient's visit history, newest first, each carrying its latest
 * risk assessment - up to VISIT_HISTORY_LIMIT of them. The backend's own
 * page default (20) is not the same thing as "every visit"; without an
 * explicit limit, a patient with more than 20 visits would silently lose
 * the older ones from both the table and the displayed visit count.
 */
export function useVisits(patientId: string) {
  return useQuery({
    queryKey: visitsQueryKey(patientId),
    queryFn: () =>
      apiFetch<VisitListResponse>(`/api/patients/${patientId}/visits?limit=${VISIT_HISTORY_LIMIT}`),
  });
}

/** Records a visit; the backend scores it inline and returns the risk assessment with it. */
export function useCreateVisit(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVisitInput) =>
      apiFetch<{ data: Visit }>(`/api/patients/${patientId}/visits`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: visitsQueryKey(patientId) });
      // A new visit changes what the patient list shows for this patient
      // (visit_count, last_visit_date, risk_assessment), so its cache is
      // stale too, not just this patient's own visit history.
      queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
  });
}
