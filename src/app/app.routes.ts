import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { Budget } from './components/budget/budget';
import { Login } from './components/login/login';
import { AuthCallback } from './components/auth-callback/auth-callback';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'login', component: Login },
    { path: 'auth/callback', component: AuthCallback },
    { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
    { path: 'budget', component: Budget, canActivate: [authGuard] },
    { path: 'loans', loadComponent: () => import('./components/loans/loans').then(m => m.Loans), canActivate: [authGuard] },
    { path: 'credit-cards', loadComponent: () => import('./components/credit-cards/credit-cards').then(m => m.CreditCards), canActivate: [authGuard] },
    { path: 'subscriptions', loadComponent: () => import('./components/subscriptions/subscriptions').then(m => m.Subscriptions), canActivate: [authGuard] },
    { 
        path: 'investments', 
        loadComponent: () => import('./components/investments/investments').then(m => m.Investments),
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'gold', pathMatch: 'full' },
            { path: 'gold', loadComponent: () => import('./components/investments/gold-silver/gold-silver').then(m => m.GoldSilver) },
            { path: 'post-office', loadComponent: () => import('./components/investments/post-office/post-office').then(m => m.PostOffice) },
            { path: 'mutual-funds', loadComponent: () => import('./components/investments/mutual-funds/mutual-funds').then(m => m.MutualFunds) },

        ]
    }
];
