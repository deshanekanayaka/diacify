export type RiskCategoryDB = "low" | "medium" | "high";

export interface Patient {
  id: string;
  clinician_id: string;
  patient_code: string;
  sex: "male" | "female" | "other";
  dob: string;
  social_life: string | null;
  genetics: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  visit_date: string;
  age: number;
  bp_systolic: number;
  bp_diastolic: number;
  cholesterol: number;
  triglycerides: number;
  hdl: number;
  ldl: number;
  vldl: number;
  hba1c: number;
  bmi: number;
  rbs: number;
  risk_score: number;
  risk_category: RiskCategoryDB;
  top_factors: string[];
  confidence_low: number;
  confidence_medium: number;
  confidence_high: number;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  scheduled_date: string;
  appointment_type: "routine" | "urgent" | "follow-up";
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled";
  created_at: string;
}

export interface PatientWithLatest extends Patient {
  latest_visit: Visit | null;
  previous_visit: Visit | null;
  recent_scores: number[];
}
