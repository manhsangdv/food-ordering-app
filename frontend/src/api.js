// frontend/src/api.js
import axios from 'axios';

// Ưu tiên lấy từ biến build-time; fallback localhost:4000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// --- Restaurant APIs ---
export const getRestaurants = () => apiClient.get('/restaurants');
export const getRestaurantMenu = (restaurantId) => apiClient.get(`/restaurants/${restaurantId}/menu`);

// --- Order APIs ---
export const createOrder = (orderData) => apiClient.post('/orders', orderData);
export const getOrderById = (orderId) => apiClient.get(`/orders/${orderId}`);

