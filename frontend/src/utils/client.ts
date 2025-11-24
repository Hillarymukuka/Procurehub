import axios from "axios";

// In development, let Vite proxy handle API calls (baseURL="").
// In production, use VITE_API_BASE_URL if provided.
const computedBaseUrl = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export const apiClient = axios.create({
  baseURL: computedBaseUrl,
  withCredentials: false,
});

// Add request interceptor to always include the auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("procurahub.token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle authentication errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      localStorage.removeItem("procurahub.token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

