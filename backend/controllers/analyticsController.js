import { query } from '../config/database.js';
import logger from '../utils/logger.js';

const emptyRiskCategoryCounts = month => ({
    month,
    low: 0,
    medium: 0,
    high: 0,
});

const emptyHba1cAverages = month => ({
    month,
    avgLow: null,
    avgMedium: null,
    avgHigh: null,
});

const normalizeRiskCategory = riskCategory => String(riskCategory || '').toLowerCase();

const pivotRiskCategoryCounts = rows => {
    const byMonth = new Map();

    rows.forEach(row => {
        if (!byMonth.has(row.month)) {
            byMonth.set(row.month, emptyRiskCategoryCounts(row.month));
        }

        const monthData = byMonth.get(row.month);
        const category = normalizeRiskCategory(row.risk_category);

        if (category === 'low' || category === 'medium' || category === 'high') {
            monthData[category] = Number(row.count);
        }
    });

    return Array.from(byMonth.values());
};

const pivotHba1cAverages = rows => {
    const byMonth = new Map();
    const categoryKeys = {
        low: 'avgLow',
        medium: 'avgMedium',
        high: 'avgHigh',
    };

    rows.forEach(row => {
        if (!byMonth.has(row.month)) {
            byMonth.set(row.month, emptyHba1cAverages(row.month));
        }

        const monthData = byMonth.get(row.month);
        const category = normalizeRiskCategory(row.risk_category);
        const averageKey = categoryKeys[category];

        if (averageKey) {
            monthData[averageKey] = row.avg_hba1c === null ? null : Number(row.avg_hba1c);
        }
    });

    return Array.from(byMonth.values());
};

// Fetches aggregated analytics data for the authenticated clinician's patient list
const getAnalytics = async (req, res) => {
    const clerkId = req.auth?.userId;

    if (!clerkId) {
        return res.status(401).json({ error: 'Authenticated user is required' });
    }

    try {
        const riskCategoryRows = await query(
            `SELECT
                DATE_FORMAT(v.visit_date, '%Y-%m') AS month,
                v.risk_category,
                COUNT(*) AS count
            FROM visits v
            JOIN patients p ON v.patient_id = p.patient_id
            WHERE p.clerk_id = ?
              AND v.visit_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY month, v.risk_category
            ORDER BY month ASC`,
            [clerkId]
        );

        const hba1cRows = await query(
            `SELECT
                DATE_FORMAT(v.visit_date, '%Y-%m') AS month,
                v.risk_category,
                ROUND(AVG(v.hba1c), 2) AS avg_hba1c
            FROM visits v
            JOIN patients p ON v.patient_id = p.patient_id
            WHERE p.clerk_id = ?
              AND v.visit_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND v.hba1c IS NOT NULL
            GROUP BY month, v.risk_category
            ORDER BY month ASC`,
            [clerkId]
        );

        const riskScoreDistributionRows = await query(
            `SELECT
                score_band,
                COUNT(*) AS count
            FROM (
                SELECT
                    CASE
                        WHEN risk_score >= 0  AND risk_score < 10 THEN '0-10'
                        WHEN risk_score >= 10 AND risk_score < 20 THEN '10-20'
                        WHEN risk_score >= 20 AND risk_score < 30 THEN '20-30'
                        WHEN risk_score >= 30 AND risk_score < 40 THEN '30-40'
                        WHEN risk_score >= 40 AND risk_score < 50 THEN '40-50'
                        WHEN risk_score >= 50 AND risk_score < 60 THEN '50-60'
                        WHEN risk_score >= 60 AND risk_score < 70 THEN '60-70'
                        WHEN risk_score >= 70 AND risk_score < 80 THEN '70-80'
                        WHEN risk_score >= 80 AND risk_score < 90 THEN '80-90'
                        WHEN risk_score >= 90 AND risk_score <= 100 THEN '90-100'
                    END AS score_band
                FROM (
                    SELECT
                        v.patient_id,
                        v.risk_score,
                        ROW_NUMBER() OVER (
                            PARTITION BY v.patient_id
                            ORDER BY v.visit_date DESC
                        ) AS visit_rank
                    FROM visits v
                    JOIN patients p ON v.patient_id = p.patient_id
                    WHERE p.clerk_id = ?
                ) ranked_visits
                WHERE visit_rank = 1
                  AND risk_score IS NOT NULL
            ) latest_scores
            WHERE score_band IS NOT NULL
            GROUP BY score_band
            ORDER BY FIELD(
                score_band,
                '0-10',
                '10-20',
                '20-30',
                '30-40',
                '40-50',
                '50-60',
                '60-70',
                '70-80',
                '80-90',
                '90-100'
            )`,
            [clerkId]
        );

        const riskCategoryMigration = pivotRiskCategoryCounts(riskCategoryRows);
        const hba1cByRiskGroup = pivotHba1cAverages(hba1cRows);
        const riskScoreDistribution = riskScoreDistributionRows.map(row => ({
            score_band: row.score_band,
            count: Number(row.count),
        }));

        res.json({
            riskCategoryMigration,
            hba1cByRiskGroup,
            riskScoreDistribution,
        });

    } catch (error) {
        // Logs the full error server-side and returns a safe message to the client
        logger.error('Analytics query error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
};

export { getAnalytics };
