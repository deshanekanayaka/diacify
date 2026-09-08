import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "../lib/apiClient";

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

/** Fetches a patient's visit history, newest first, each carrying its latest risk assessment. */
export function useVisits(patientId: string) {
  return useQuery({
    queryKey: visitsQueryKey(patientId),
    queryFn: () => apiFetch<VisitListResponse>(`/api/patients/${patientId}/visits`),
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
    },
  });
}
