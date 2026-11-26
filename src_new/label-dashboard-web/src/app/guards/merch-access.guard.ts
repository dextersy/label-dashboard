import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { BrandService } from '../services/brand.service';

export const merchAccessGuard: CanActivateFn = (_route, _state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const brandService = inject(BrandService);

  if (!authService.isAdmin()) {
    router.navigate(['/dashboard']);
    return false;
  }

  const settings = brandService.getCurrentBrandSettings();
  if (settings?.feature_merch_workspace === false) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
