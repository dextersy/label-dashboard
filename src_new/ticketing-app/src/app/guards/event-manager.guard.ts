import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { EventsService } from '../services/events.service';
import { map, catchError, of } from 'rxjs';

export const eventManagerGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const eventsService = inject(EventsService);
  const router = inject(Router);
  const id = Number(route.paramMap.get('id'));

  return eventsService.getEvent(id).pipe(
    map(event => {
      if (event.user_role === 'owner' || event.user_role === 'manager') {
        return true;
      }
      return router.createUrlTree(['/app/events', id]);
    }),
    catchError(() => of(router.createUrlTree(['/app/events'])))
  );
};
