import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AudienceAuthService } from '../services/audience-auth.service';

export const audienceAuthGuard: CanActivateFn = () => {
  const audienceAuth = inject(AudienceAuthService);
  const router = inject(Router);

  if (audienceAuth.isLoggedIn()) {
    return true;
  }

  router.navigate(['/login'], { queryParams: { mode: 'audience' } });
  return false;
};
