import React from 'react';

// counts is derived in Dashboard.jsx by iterating the patients array
// and passed down as a prop
const StatCards = ({ counts = { high: 0, medium: 0, low: 0 }, loading = false }) => {
    const display = (val) => (loading ? '…' : val);

    return (
        <div className="stat-cards-container">
            <div className="stat-card high">
                <p className="stat-card-title">High Risk Patients</p>
                <p className="stat-card-value">{display(counts.high)}</p>
            </div>
            <div className="stat-card medium">
                <p className="stat-card-title">Medium Risk Patients</p>
                <p className="stat-card-value">{display(counts.medium)}</p>
            </div>
            <div className="stat-card low">
                <p className="stat-card-title">Low Risk Patients</p>
                <p className="stat-card-value">{display(counts.low)}</p>
            </div>
        </div>
    );
};

export default StatCards;