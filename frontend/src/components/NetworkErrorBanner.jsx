import { useState, useEffect } from 'react';
import api from '../utils/axiosConfig';

export default function NetworkErrorBanner() {
    const [visible, setVisible] = useState(false);
    const [retrying, setRetrying] = useState(false);

    useEffect(() => {
        const show = () => setVisible(true);
        const hide = () => setVisible(false);
        window.addEventListener('network-error', show);
        window.addEventListener('network-restored', hide);
        return () => {
            window.removeEventListener('network-error', show);
            window.removeEventListener('network-restored', hide);
        };
    }, []);

    if (!visible) return null;

    const retry = () => {
        setRetrying(true);
        api.get('/health').then(() => {
            window.dispatchEvent(new Event('network-restored'));
            setVisible(false);
        }).catch(() => { setRetrying(false); });
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm">Unable to reach the server. Check your connection or try again later.</span>
            <button
                onClick={retry}
                disabled={retrying}
                className={`ml-4 px-3 py-1 bg-white/20 border border-white/50 rounded text-white text-xs cursor-pointer hover:bg-white/30 whitespace-nowrap${retrying ? ' opacity-70 cursor-not-allowed' : ''}`}
            >
                {retrying ? 'Retrying...' : 'Retry'}
            </button>
        </div>
    );
}
