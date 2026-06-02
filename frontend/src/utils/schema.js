import { z } from 'zod';

const requiredNumber = (min, max, minMsg, maxMsg) =>
    z.preprocess(
        (val) => {
            if (val === '' || val === null || val === undefined) return undefined;
            const num = Number(val);
            return isNaN(num) ? NaN : num;
        },
        z.number({
            required_error: 'This field is required',
            invalid_type_error: 'Please enter a valid number',
        })
            .min(min, minMsg)
            .max(max, maxMsg)
    );

export const patientSchema = z.object({
    age:           requiredNumber(0,    120,  'Min 0',   'Max 120'  ),
    sex:           z.enum(['male', 'female'],  { required_error: 'Required' }),
    social_life:   z.enum(['city', 'village'], { required_error: 'Required' }),
    bp_systolic:   requiredNumber(60,   250,  'Min 60',  'Max 250'  ),
    bp_diastolic:  requiredNumber(40,   150,  'Min 40',  'Max 150'  ),
    bmi:           requiredNumber(10,   70,   'Min 10',  'Max 70'   ),
    cholesterol:   requiredNumber(0,    600,  'Min 0',   'Max 600'  ),
    triglycerides: requiredNumber(0,    1000, 'Min 0',   'Max 1000' ),
    hdl:           requiredNumber(0,    200,  'Min 0',   'Max 200'  ),
    ldl:           requiredNumber(0,    300,  'Min 0',   'Max 300'  ),
    vldl:          requiredNumber(0,    150,  'Min 0',   'Max 150'  ),
    hba1c:         requiredNumber(0,    20,   'Min 0',   'Max 20'   ),
    rbs:           requiredNumber(0,    600,  'Min 0',   'Max 600'  ),
});

export const patientCreateSchema = patientSchema.extend({
    clerk_id: z.string().min(1, 'clerk_id is required'),
});

// Returns an object mapping field names to short warning labels.
// Each key matches the field name so PatientFormModal can highlight
// the exact input that has an unusual but clinically valid value.
// Sources: ADA Standards of Care, Diabetes UK, WHO BMI Classification, NICE Lipid Guidelines
export const checkWarnings = (data) => {
    const warnings = {};

    // ADA: HbA1c ≥6.5% indicates diabetic range; <4.0% is unusually low
    if (data.hba1c >= 6.5) warnings.hba1c = 'Diabetic range';
    if (data.hba1c < 4.0)  warnings.hba1c = 'Unusually low';

    // WHO: BMI ≥30 indicates obesity; <18.5 indicates underweight
    if (data.bmi >= 30)   warnings.bmi = 'Obese';
    if (data.bmi < 18.5)  warnings.bmi = 'Underweight';

    // Diabetes UK: BP target for diabetic patients is below 140/90mmHg (14.0/9.0 in dataset units)
    if (data.bp_systolic >= 14.0)  warnings.bp_systolic  = 'Above target';
    if (data.bp_diastolic >= 9.0)  warnings.bp_diastolic = 'Above target';

    // ADA: RBS ≥200 mg/dL meets the threshold for diabetes diagnosis
    if (data.rbs >= 200) warnings.rbs = 'Diabetic threshold';

    // NICE: Total cholesterol ≥240 mg/dL is high; ≥200 mg/dL is borderline high
    if (data.cholesterol >= 240)       warnings.cholesterol = 'High';
    else if (data.cholesterol >= 200)  warnings.cholesterol = 'Borderline high';

    // NICE: LDL ≥130 mg/dL is borderline high for diabetic patients
    if (data.ldl >= 130) warnings.ldl = 'Borderline high';

    // Threshold lowered to <25 based on dataset distribution to avoid false positives
    if (data.hdl < 25) warnings.hdl = 'Critically low';

    return warnings;
};