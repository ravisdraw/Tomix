import { Injectable } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';
import { map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.session$.pipe(
    take(1),
    map((session) => {
      if (session) {
        return true;
      } else {
        router.navigate(['/login']);
        return false;
      }
    })
  );
};
