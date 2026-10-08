import { authService as sharedAuthService, userService } from '@music-cloud/services';

export const authService = {
  ...sharedAuthService,
  getCurrentUser: async () => {
    try {
      return await userService.getCurrentProfile();
    } catch {
      return null;
    }
  },
};

export default authService;
