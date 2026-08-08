import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AudienceAuthService } from '../services/audience-auth.service';

export const audienceAuthGuard: CanActivateFn = () => {
  const audienceAuth = inject(AudienceAuthService);
  const router = inject(Router);

  if (!audienceAuth.isLoggedIn()) {
    router.navigate(['/login'], { queryParams: { mode: 'audience' } });
    return false;
  }

  const user = audienceAuth.getUser();
  if (user && (!user.terms_accepted_at || !user.privacy_accepted_at || !user.age_confirmed_at)) {
    router.navigate(['/accept-terms']);
    return false;
  }

  return true;
};
