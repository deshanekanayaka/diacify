import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';

const API_BASE = import.meta.env.VITE_API_URL;

// Custom hook that fetches aggregated analytics data for the signed-in clinician
const useAnalytics = () => {
    const { user } = useUser();
    const { getToken } = useAuth();

    // Initialised with empty arrays matching the API response shape —
    // charts render safely before data arrives without crashing on undefined
    const [data, setData] = useState({
        ageDistribution: [],
        riskScoreDistribution: [],
        riskTrend: [],
    });

    // Starts as true so the loading state is correct before the first fetch runs
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Re-runs whenever the user object changes, e.g. after sign-in completes
    useEffect(() => {
        // Skips the fetch if Clerk hasn't resolved the user yet
        if (!user) return;

        // Allows the in-flight request to be cancelled if the component unmounts
        const controller = new AbortController();

        const fetchAnalytics = async () => {
            try {
                const token = await getToken();
                const res = await fetch(
                    `${API_BASE}/api/analytics?clerk_id=${user.id}`,
                    {
                        signal: controller.signal,
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                // fetch does not automatically fail on error responses like axios does,
                // so without this check a 404 or 500 would be treated as success
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const json = await res.json();
                setData(json);

            } catch (err) {

                // If the page was closed mid-fetch, warn.
                if (err.name !== 'AbortError') {
                    setError(err.message);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();

        // Cancels the fetch if the component unmounts before the response arrives
        return () => controller.abort();

    }, [user, getToken]);

    return { data, loading, error };
};

export default useAnalytics;