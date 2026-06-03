import { jest } from '@jest/globals';

const mockDb = {
  query:    jest.fn(),
  queryOne: jest.fn(),
  execute:  jest.fn(),
};

const mockLogger = {
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockAxios = {
  post: jest.fn(),
  get:  jest.fn(),
  default: { post: jest.fn(), get: jest.fn() },
};

jest.unstable_mockModule('../config/database.js', () => mockDb);
jest.unstable_mockModule('../utils/logger.js',    () => ({ default: mockLogger }));
jest.unstable_mockModule('axios',                 () => ({ default: mockAxios }));

// Dynamic imports must come AFTER jest.unstable_mockModule calls
const { default: express }        = await import('express');
const { default: patientsRouter } = await import('../routes/patients.js');
const { default: request }        = await import('supertest');

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.auth = { userId: 'test_user_clerk_123' };
    next();
  });
  app.use('/api/patients', patientsRouter);
  return app;
};

describe('POST /api/patients', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    mockDb.query.mockReset();
    mockDb.queryOne.mockReset();
    mockDb.execute.mockReset();
    mockAxios.post.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();

    // Set default environment
    process.env.ML_SERVICE_URL = 'http://localhost:8001';
    process.env.ML_INTERNAL_SECRET = 'test_secret';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * TEST 1: Happy path
   * Valid patient data, ML service responds successfully.
   * Expect: 201 status, success: true, patient_id starts with 'PAT-',
   * risk_category is one of low/medium/high, ml_pending is false.
   */
  it('TEST 1: Happy path - valid patient data with ML success', async () => {
    // Setup database mocks
    mockDb.queryOne.mockResolvedValueOnce({ count: 5 }); // Next sequence number
    mockDb.execute.mockResolvedValueOnce(undefined); // INSERT patients
    mockDb.execute.mockResolvedValueOnce({ insertId: 1001 }); // INSERT visits
    mockDb.execute.mockResolvedValueOnce(undefined); // INSERT audit_log

    // Setup axios mock for successful ML response
    mockAxios.post.mockResolvedValueOnce({
      data: {
        risk_score: 65,
        risk_category: 'high',
        top_factors: ['hba1c', 'bmi'],
        confidence_low: 0.1,
        confidence_medium: 0.25,
        confidence_high: 0.65,
        low_confidence: false,
      },
    });

    const validPatient = {
      age: 45,
      sex: 'male',
      social_life: 'city',
      bp_systolic: 130,
      bp_diastolic: 85,
      bmi: 28,
      cholesterol: 210,
      triglycerides: 150,
      hdl: 40,
      ldl: 130,
      vldl: 30,
      hba1c: 7.5,
      rbs: 180,
    };

    const response = await request(app)
      .post('/api/patients')
      .send(validPatient)
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Patient created successfully',
        ml_pending: false,
      })
    );

    // Verify patient_id format
    expect(response.body.data.patient_id).toMatch(/^PAT-\d{4}-\d{4}$/);

    // Verify risk_category is valid
    expect(['low', 'medium', 'high']).toContain(response.body.data.risk_category);

    // Verify ML service was called
    expect(mockAxios.post).toHaveBeenCalledWith(
      'http://localhost:8001/predict',
      expect.objectContaining({
        age: 45,
        sex: 'male',
        hba1c: 7.5,
        bmi: 28,
      }),
      expect.any(Object)
    );

    // Verify database calls
    expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
    expect(mockDb.execute).toHaveBeenCalledTimes(3);
  });

  /**
   * TEST 2: Missing required field
   * Send body with hba1c missing.
   * Expect: 400 status, success: false, errors array contains
   * string mentioning hba1c.
   */
  it('TEST 2: Missing required field - hba1c not provided', async () => {
    const invalidPatient = {
      age: 45,
      sex: 'male',
      social_life: 'city',
      bp_systolic: 130,
      bp_diastolic: 85,
      bmi: 28,
      cholesterol: 210,
      triglycerides: 150,
      hdl: 40,
      ldl: 130,
      vldl: 30,
      // hba1c is missing
      rbs: 180,
    };

    const response = await request(app)
      .post('/api/patients')
      .send(invalidPatient)
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
      })
    );

    // Verify errors array contains hba1c reference
    expect(response.body.errors).toBeDefined();
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(
      response.body.errors.some((error) => error.toLowerCase().includes('hba1c'))
    ).toBe(true);

    // Verify no database queries were made
    expect(mockDb.queryOne).not.toHaveBeenCalled();
    expect(mockDb.execute).not.toHaveBeenCalled();
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  /**
   * TEST 3: Invalid clinical value
   * Send hba1c: 99 (above max of 20).
   * Expect: 400 status, success: false, errors array mentions hba1c.
   */
  it('TEST 3: Invalid clinical value - hba1c exceeds maximum', async () => {
    const invalidPatient = {
      age: 45,
      sex: 'male',
      social_life: 'city',
      bp_systolic: 130,
      bp_diastolic: 85,
      bmi: 28,
      cholesterol: 210,
      triglycerides: 150,
      hdl: 40,
      ldl: 130,
      vldl: 30,
      hba1c: 99, // Invalid: max is 20
      rbs: 180,
    };

    const response = await request(app)
      .post('/api/patients')
      .send(invalidPatient)
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
      })
    );

    // Verify errors array mentions hba1c
    expect(response.body.errors).toBeDefined();
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(
      response.body.errors.some((error) => error.toLowerCase().includes('hba1c'))
    ).toBe(true);

    // Verify no database writes occurred
    expect(mockDb.execute).not.toHaveBeenCalled();
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  /**
   * TEST 4: ML service unavailable
   * Mock axios to throw a network error on the ML call.
   * Expect: 201 status, success: true, ml_pending: true,
   * risk_category: 'pending'. Patient must still be saved.
   */
  it('TEST 4: ML service unavailable - patient saved with pending status', async () => {
    // Setup database mocks
    mockDb.queryOne.mockResolvedValueOnce({ count: 0 }); // First patient of the year
    mockDb.execute.mockResolvedValueOnce(undefined); // INSERT patients
    mockDb.execute.mockResolvedValueOnce({ insertId: 2001 }); // INSERT visits
    mockDb.execute.mockResolvedValueOnce(undefined); // INSERT audit_log

    // Setup axios mock to throw a network error
    mockAxios.post.mockRejectedValueOnce(
      new Error('Network error: ECONNREFUSED')
    );

    const validPatient = {
      age: 52,
      sex: 'female',
      social_life: 'village',
      bp_systolic: 145,
      bp_diastolic: 95,
      bmi: 32,
      cholesterol: 250,
      triglycerides: 200,
      hdl: 35,
      ldl: 160,
      vldl: 40,
      hba1c: 8.2,
      rbs: 220,
    };

    const response = await request(app)
      .post('/api/patients')
      .send(validPatient)
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Patient created successfully',
        ml_pending: true,
      })
    );

    // Verify risk_category is 'pending'
    expect(response.body.data.risk_category).toBe('pending');

    // Verify patient was still created (database calls were made)
    expect(mockDb.execute).toHaveBeenCalledTimes(3); // patients, visits, audit_log

    // Verify the INSERT visits call used risk_category 'pending'
    const insertVisitsCall = mockDb.execute.mock.calls[1];
    const visitSQL = insertVisitsCall[0];
    const visitValues = insertVisitsCall[1];

    // The risk_category should be 'pending' (index 13 in the values array)
    expect(visitValues[13]).toBe('pending');

    // Verify logger.warn was called for the ML error
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ML service unavailable'),
      expect.any(String)
    );
  });

  /**
   * Additional edge case tests
   */

  it('should reject patient with all zero clinical values', async () => {
    const invalidPatient = {
      age: 0,
      sex: 'male',
      social_life: 'city',
      bp_systolic: 0,
      bp_diastolic: 0,
      bmi: 0,
      cholesterol: 0,
      triglycerides: 0,
      hdl: 0,
      ldl: 0,
      vldl: 0,
      hba1c: 0,
      rbs: 0,
    };

    const response = await request(app)
      .post('/api/patients')
      .send(invalidPatient)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errors).toBeDefined();
  });

  it('should reject patient with invalid sex enum', async () => {
    const invalidPatient = {
      age: 45,
      sex: 'other', // Invalid enum
      social_life: 'city',
      bp_systolic: 130,
      bp_diastolic: 85,
      bmi: 28,
      cholesterol: 210,
      triglycerides: 150,
      hdl: 40,
      ldl: 130,
      vldl: 30,
      hba1c: 7.5,
      rbs: 180,
    };

    const response = await request(app)
      .post('/api/patients')
      .send(invalidPatient)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.errors).toBeDefined();
  });

  it('should handle string numbers that can be converted', async () => {
    // Setup database mocks
    mockDb.queryOne.mockResolvedValueOnce({ count: 10 });
    mockDb.execute.mockResolvedValueOnce(undefined); // INSERT patients
    mockDb.execute.mockResolvedValueOnce({ insertId: 1002 }); // INSERT visits
    mockDb.execute.mockResolvedValueOnce(undefined); // INSERT audit_log

    // Setup axios mock
    mockAxios.post.mockResolvedValueOnce({
      data: {
        risk_score: 50,
        risk_category: 'medium',
        top_factors: ['bmi'],
        confidence_low: 0.3,
        confidence_medium: 0.5,
        confidence_high: 0.2,
        low_confidence: false,
      },
    });

    const patientWithStringNumbers = {
      age: '40', // String that can be converted
      sex: 'male',
      social_life: 'city',
      bp_systolic: '125',
      bp_diastolic: '80',
      bmi: '26',
      cholesterol: '200',
      triglycerides: '120',
      hdl: '50',
      ldl: '110',
      vldl: '24',
      hba1c: '6.2',
      rbs: '130',
    };

    const response = await request(app)
      .post('/api/patients')
      .send(patientWithStringNumbers)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.patient_id).toMatch(/^PAT-\d{4}-\d{4}$/);
  });

  it('should create unique patient_ids for consecutive creations', async () => {
    // First patient
    mockDb.queryOne.mockResolvedValueOnce({ count: 0 });
    mockDb.execute.mockResolvedValueOnce(undefined);
    mockDb.execute.mockResolvedValueOnce({ insertId: 1 });
    mockDb.execute.mockResolvedValueOnce(undefined);

    mockAxios.post.mockResolvedValueOnce({
      data: {
        risk_score: 45,
        risk_category: 'low',
        top_factors: [],
        confidence_low: 0.8,
        confidence_medium: 0.15,
        confidence_high: 0.05,
        low_confidence: false,
      },
    });

    const validPatient = {
      age: 30,
      sex: 'male',
      social_life: 'city',
      bp_systolic: 115,
      bp_diastolic: 75,
      bmi: 22,
      cholesterol: 180,
      triglycerides: 90,
      hdl: 55,
      ldl: 100,
      vldl: 18,
      hba1c: 5.2,
      rbs: 100,
    };

    const response1 = await request(app)
      .post('/api/patients')
      .send(validPatient)
      .expect(201);

    const patientId1 = response1.body.data.patient_id;

    // Second patient
    mockDb.queryOne.mockResolvedValueOnce({ count: 1 });
    mockDb.execute.mockResolvedValueOnce(undefined);
    mockDb.execute.mockResolvedValueOnce({ insertId: 2 });
    mockDb.execute.mockResolvedValueOnce(undefined);

    mockAxios.post.mockResolvedValueOnce({
      data: {
        risk_score: 55,
        risk_category: 'medium',
        top_factors: ['hba1c'],
        confidence_low: 0.25,
        confidence_medium: 0.6,
        confidence_high: 0.15,
        low_confidence: false,
      },
    });

    const response2 = await request(app)
      .post('/api/patients')
      .send(validPatient)
      .expect(201);

    const patientId2 = response2.body.data.patient_id;

    // Verify unique IDs
    expect(patientId1).not.toEqual(patientId2);
    expect(patientId1).toMatch(/^PAT-\d{4}-0001$/);
    expect(patientId2).toMatch(/^PAT-\d{4}-0002$/);
  });
});
