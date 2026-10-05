import apiClient from '../api';
import type { User } from '../types';

export const userService = {
  getCurrentProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/v1/users/me');
    return response.data;
  },
};
