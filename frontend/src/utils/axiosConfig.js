import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (!error.response) {
            window.__networkError = true;
            window.dispatchEvent(new Event('network-error'));
        }
        return Promise.reject(error);
    }
);

export default api;
