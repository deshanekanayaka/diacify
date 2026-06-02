import { useNavigate } from 'react-router-dom';


export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-white min-h-screen">
      {/* NAVBAR */}
      {/* NAVBAR */}
<nav className="bg-white border-b border-gray-100">
  <div className="flex items-center justify-center px-8 py-4">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6.5" y="1" width="5" height="16" rx="2" fill="white"/>
          <rect x="1" y="6.5" width="16" height="5" rx="2" fill="white"/>
        </svg>
      </div>
      <span className="text-base font-semibold text-gray-900">Diacify</span>
    </div>
  </div>
</nav>

      {/* HERO SECTION */}
      <section
        className="pt-24 pb-16 flex flex-col items-center justify-center text-center px-8"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 70% -10%, rgba(37,99,235,0.07) 0%, transparent 70%)' }}
      >
        

        {/* Headline */}
        <h1 className="text-5xl font-bold text-gray-900 max-w-2xl leading-tight mb-6">
          Prioritize the patients who need care{' '}
          <em className="text-blue-600 not-italic">first.</em>
        </h1>

        {/* Subheading */}
        <p className="text-gray-500 text-base max-w-lg leading-relaxed mb-8">
          ML-powered risk scoring ranks your diabetic patients across 13 clinical indicators — so urgent cases always surface automatically.
        </p>

        {/* Buttons */}
        <div className="flex gap-3 mb-10">
          <button
            onClick={() => navigate('/sign-up')}
            className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Create account
          </button>
          <button
            onClick={() => navigate('/sign-in')}
            className="px-6 py-3 border border-gray-300 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Sign in →
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex gap-12 pt-8 border-t border-gray-100">
          <div>
            <div className="text-3xl font-bold text-blue-600">13</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Clinical indicators</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">0–100</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Risk score range</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">3</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Risk categories</div>
          </div>
        </div>
      </section>

      {/* THREE STEPS SECTION */}
      <section className="bg-white border-t border-b border-gray-100 py-20 px-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          From entry to intervention, in three steps.
        </h2>
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-7">
            <div className="text-4xl font-bold text-blue-600 mb-4">1</div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Add patient data</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Enter HbA1c, blood pressure, lipid panel, glucose levels and demographics through a validated clinical form with range checking.
            </p>
          </div>
          {/* Card 2 */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-7">
            <div className="text-4xl font-bold text-blue-600 mb-4">2</div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Auto risk score</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              The Random Forest model weighs all 13 factors and returns a 0–100 score classified as Low, Medium or High — instantly.
            </p>
          </div>
          {/* Card 3 */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-7">
            <div className="text-4xl font-bold text-blue-600 mb-4">3</div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Act on priorities</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your patient list is ranked by urgency. Focus your time where it makes the biggest clinical difference.
            </p>
          </div>
        </div>
      </section>

      {/* PRINCIPLES SECTION */}
      <section className="bg-gray-50 py-24 px-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Built the way clinicians think.
        </h2>
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-16">
          {/* Principle 1 */}
          <div>
            <div className="w-2 h-2 rounded-full bg-blue-600 mb-4" />
            <h3 className="font-semibold text-gray-900 mb-3">Ranked, not filtered</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Every patient gets a score. The highest-risk cases rise to the top automatically — no one falls through the cracks.
            </p>
          </div>
          {/* Principle 2 */}
          <div>
            <div className="w-2 h-2 rounded-full bg-amber-500 mb-4" />
            <h3 className="font-semibold text-gray-900 mb-3">Transparent scoring</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              See exactly which indicators drove each patient's score. The model shows its work — no black-box predictions.
            </p>
          </div>
          {/* Principle 3 */}
          <div>
            <div className="w-2 h-2 rounded-full bg-green-500 mb-4" />
            <h3 className="font-semibold text-gray-900 mb-3">Updates as you do</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Enter new lab results and watch the risk score recalculate in real time. No batch processing, no overnight runs.
            </p>
          </div>
        </div>
      </section>

      {/* INDICATORS SECTION */}
      <section className="bg-white border-t border-b border-gray-100 py-20 px-8">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Every factor, accounted for.
        </h2>
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-0">
          {[
            'HbA1c',
            'BMI',
            'Blood pressure (systolic)',
            'Blood pressure (diastolic)',
            'Cholesterol',
            'Triglycerides',
            'HDL',
            'LDL',
            'VLDL',
            'Random blood sugar',
            'Age',
            'Gender',
            'Social setting',
          ].map((indicator, idx) => (
            <div key={idx} className="flex items-center gap-3 py-3 border-b border-gray-100 text-sm font-medium text-gray-800">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <rect width="16" height="16" rx="4" fill="#dbeafe"/>
                <path d="M4 8l3 3 5-5" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{indicator}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CLOSING CTA SECTION */}
      <section className="bg-gray-50 py-28 px-8 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">
          Start with the patient who needs you first.
        </h2>
        <p className="text-gray-500 mb-8">
          Your panel, ranked by clinical urgency. Ready in minutes.
        </p>
        <button
          onClick={() => navigate('/sign-up')}
          className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          Create account
        </button>
      </section>

      {/* FOOTER */}
      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
        © 2026 Diacify — Decision support only. Risk scores do not constitute a clinical diagnosis.
      </footer>
    </div>
  );
}
