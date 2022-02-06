import aspida from '@aspida/fetch';
import api from '@portal/api/api/$api';

export const aspidaConfig = {
  baseURL: process.env.NEXT_PUBLIC_PORTAL_API_BASE_URL || 'http://localhost:3040',
  throwHttpErrors: true,
};
export const apiClient = api(aspida(undefined, { ...aspidaConfig }));
