import axios from 'axios';
import { withBase } from './basePath';

/** No auth interceptor side-effects for public endpoints (401 without token is harmless). */
const publicBooking = axios.create({
  baseURL: withBase('/api'),
  headers: { 'Content-Type': 'application/json' }
});

export function getBookingConfig() {
  return publicBooking.get('/public/booking/config');
}

export function getBookingSlots() {
  return publicBooking.get('/public/booking/slots');
}

export function submitBooking(payload) {
  return publicBooking.post('/public/booking/submit', payload);
}
