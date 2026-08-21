import type { AuthUser, LoginResponse } from '@hr-demo/shared';
import { apiRequest } from '../../lib/api';

export const authApi = {
  login: (username: string, password: string) =>
    apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiRequest<AuthUser>('/auth/me'),
};
