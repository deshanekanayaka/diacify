import { z } from 'zod';

// Zod validator for any numeric clinical field.
// Called once per field with its allowed range
const requiredNumber = (min, max, minMsg, maxMsg) =>
    z.preprocess(
        (val) => {
            // Empty, null, or missing fields return 'MISSING' — a string Zod's z.number()
            // rejects with invalid_type_error: 'This field is required'
            if (val === undefined || val === null || val === '') return 'MISSING';

            // Converts string inputs to numbers (e.g. form sends "45", model needs 45)
            const num = Number(val);

            // // If conversion fails (e.g. "abc"), treat it the same as missing
            return isNaN(num) ? 'MISSING' : num;
        },
        z.number({
            required_error: 'This field is required',
            invalid_type_error: 'This field is required',
        })
            .min(min, minMsg)
            .max(max, maxMsg)
    );

const patientSchema = z.object({
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
    genetics:      z.number().int().min(0).max(4).optional().default(0),
});

const patientCreateSchema = patientSchema.extend({
    clerk_id: z.string().min(1, 'clerk_id is required'),
});

// Warning thresholds based on clinical guidelines.
const checkWarnings = (data) => {
    const warnings = {};

    if (data.hba1c >= 6.5)          warnings.hba1c        = 'Diabetic range';
    else if (data.hba1c < 4.0)      warnings.hba1c        = 'Unusually low';

    if (data.bmi >= 30)             warnings.bmi          = 'Obese';
    else if (data.bmi < 18.5)       warnings.bmi          = 'Underweight';

    if (data.bp_systolic >= 14.0)   warnings.bp_systolic  = 'Above target';
    if (data.bp_diastolic >= 9.0)   warnings.bp_diastolic = 'Above target';

    if (data.rbs >= 200)            warnings.rbs          = 'Diabetic threshold';

    if (data.cholesterol >= 240)       warnings.cholesterol = 'High';
    else if (data.cholesterol >= 200)  warnings.cholesterol = 'Borderline high';
    if (data.ldl >= 130)            warnings.ldl          = 'Borderline high';
    if (data.hdl < 25)              warnings.hdl          = 'Critically low';
    if (data.triglycerides >= 200)  warnings.triglycerides = 'Borderline high';
    if (data.vldl >= 40)            warnings.vldl         = 'Above normal';

    return warnings;
};

export { patientSchema, patientCreateSchema, checkWarnings };