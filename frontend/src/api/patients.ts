import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "../lib/apiClient";

export type PatientSex = "male" | "female";

export interface Patient {
  id: string;
  reference: string;
  sex: PatientSex;
  created_at: string;
}

interface PatientListResponse {
  data: Patient[];
  page: number;
  limit: number;
  total: number;
}

export interface CreatePatientInput {
  reference: string;
  sex: PatientSex;
}

const PATIENTS_QUERY_KEY = ["patients"] as const;

/** Fetches the caller's own patients, newest first (matches the backend's default order). */
export function usePatients() {
  return useQuery({
    queryKey: PATIENTS_QUERY_KEY,
    queryFn: () => apiFetch<PatientListResponse>("/api/patients"),
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
