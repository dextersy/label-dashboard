import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AudienceAuthService } from '../services/audience-auth.service';

export const audienceAuthGuard: CanActivateFn = (route, state: RouterStateSnapshot) => {
  const audienceAuth = inject(AudienceAuthService);
  const router = inject(Router);

  if (!audienceAuth.isLoggedIn()) {
    router.navigate(['/login'], {
      queryParams: { mode: 'audience', returnUrl: encodeURIComponent(state.url) }
    });
    return false;
  }

  const user = audienceAuth.getUser();
  if (user && (!user.terms_accepted_at || !user.privacy_accepted_at || !user.age_confirmed_at)) {
    router.navigate(['/accept-terms']);
    return false;
  }

  return true;
};
