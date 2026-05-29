import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="lp-root">

            {/* Background layers */}
            <div className="lp-bg" aria-hidden="true" />
            <div className="lp-grid" aria-hidden="true" />

            {/* Decorative SVGs */}
            <svg className="lp-deco-right" width="180" height="180" viewBox="0 0 160 160" fill="none" aria-hidden="true">
                <rect x="56" y="10" width="48" height="140" rx="12" fill="#2563eb" />
                <rect x="10" y="56" width="140" height="48" rx="12" fill="#2563eb" />
            </svg>
            <svg className="lp-deco-left" width="120" height="120" viewBox="0 0 160 160" fill="none" aria-hidden="true">
                <rect x="56" y="10" width="48" height="140" rx="12" fill="#2563eb" />
                <rect x="10" y="56" width="140" height="48" rx="12" fill="#2563eb" />
            </svg>

            {/* ── Navbar ── */}
            <nav className="lp-nav">
                <div className="lp-logo">
                    <div className="lp-logo-icon">
                        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                            <rect x="6.5" y="1" width="5" height="16" rx="2" fill="white" />
                            <rect x="1" y="6.5" width="16" height="5" rx="2" fill="white" />
                        </svg>
                    </div>
                    <span className="lp-logo-wordmark">Diabetic Patient Priority System</span>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="lp-hero">
                <div className="lp-badge">
                    <span className="lp-badge-dot" />
                    Clinical Priority System
                </div>

                <h1 className="lp-headline">
                    Prioritize the patients<br />
                    who need care <em>first.</em>
                </h1>

                <p className="lp-sub">
                    ML-powered risk scoring ranks your diabetic patients across
                    13 clinical indicators — so urgent cases always surface automatically.
                </p>

                <div className="lp-ctas">
                    <button className="lp-btn-primary" onClick={() => navigate('/sign-up')}>
                        Create account
                    </button>
                    <button className="lp-btn-secondary" onClick={() => navigate('/sign-in')}>
                        Sign in →
                    </button>
                </div>

                <div className="lp-stats">
                    <div className="lp-stat">
                        <div className="lp-stat-num"><span>13</span></div>
                        <div className="lp-stat-label">Clinical indicators</div>
                    </div>
                    <div className="lp-stat">
                        <div className="lp-stat-num">0–<span>100</span></div>
                        <div className="lp-stat-label">Risk score range</div>
                    </div>
                    <div className="lp-stat">
                        <div className="lp-stat-num"><span>3</span></div>
                        <div className="lp-stat-label">Risk categories</div>
                    </div>
                </div>
            </section>

            {/* ── Steps ── */}
            <section className="lp-steps-section">
                <div className="lp-steps-inner">
                    <h2 className="lp-steps-heading">
                        From entry to intervention, in three steps.
                    </h2>
                    <div className="lp-steps-grid">
                        <div className="lp-step-card">
                            <div className="lp-step-card-num">1</div>
                            <h3 className="lp-step-card-title">Add patient data</h3>
                            <p className="lp-step-card-desc">
                                Enter HbA1c, blood pressure, lipid panel, glucose levels and
                                demographics through a validated clinical form with range checking.
                            </p>
                        </div>
                        <div className="lp-step-card">
                            <div className="lp-step-card-num">2</div>
                            <h3 className="lp-step-card-title">Auto risk score</h3>
                            <p className="lp-step-card-desc">
                                The Random Forest model weighs all 13 factors and returns a
                                0–100 score classified as Low, Medium or High — instantly.
                            </p>
                        </div>
                        <div className="lp-step-card">
                            <div className="lp-step-card-num">3</div>
                            <h3 className="lp-step-card-title">Act on priorities</h3>
                            <p className="lp-step-card-desc">
                                Your patient list is ranked by urgency. Focus your time where
                                it makes the biggest clinical difference.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Principles ── */}
            <section className="lp-principles-section">
                <div className="lp-principles-inner">
                    <h2 className="lp-principles-heading">Built the way clinicians think.</h2>
                    <div className="lp-principles-grid">
                        <div>
                            <span className="lp-principle-item-dot lp-principle-item-dot--blue" />
                            <h3 className="lp-principle-item-title">Ranked, not filtered</h3>
                            <p className="lp-principle-item-desc">
                                Every patient gets a score. The highest-risk cases rise to the
                                top automatically — no one falls through the cracks.
                            </p>
                        </div>
                        <div>
                            <span className="lp-principle-item-dot lp-principle-item-dot--amber" />
                            <h3 className="lp-principle-item-title">Transparent scoring</h3>
                            <p className="lp-principle-item-desc">
                                See exactly which indicators drove each patient's score.
                                The model shows its work — no black-box predictions.
                            </p>
                        </div>
                        <div>
                            <span className="lp-principle-item-dot lp-principle-item-dot--green" />
                            <h3 className="lp-principle-item-title">Updates as you do</h3>
                            <p className="lp-principle-item-desc">
                                Enter new lab results and watch the risk score recalculate
                                in real time. No batch processing, no overnight runs.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Indicators ── */}
            <section className="lp-indicators-section">
                <div className="lp-indicators-inner">
                    <h2 className="lp-indicators-heading">Every factor, accounted for.</h2>
                    <div className="lp-indicators-grid">
                        {[
                            'HbA1c', 'BMI', 'Blood pressure (systolic)',
                            'Blood pressure (diastolic)', 'Cholesterol', 'Triglycerides',
                            'HDL', 'LDL', 'VLDL',
                            'Random blood sugar', 'Age', 'Gender',
                            'Social setting',
                        ].map(ind => (
                            <div className="lp-indicator-item" key={ind}>
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                                    <rect width="16" height="16" rx="4" fill="#dbeafe" />
                                    <path d="M4 8l3 3 5-5" stroke="#2563EB" strokeWidth="1.6"
                                          strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>{ind}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Closing CTA ── */}
            <section className="lp-closing-section">
                <h2 className="lp-closing-heading">
                    Start with the patient who needs you first.
                </h2>
                <p className="lp-closing-sub">
                    Your panel, ranked by clinical urgency. Ready in minutes.
                </p>
                <button className="lp-btn-primary" onClick={() => navigate('/sign-up')}>
                    Create account
                </button>
            </section>

            {/* ── Footer ── */}
            <footer className="lp-footer">
                © {new Date().getFullYear()} Diabetic Patient Priority System
            </footer>

        </div>
    );
}