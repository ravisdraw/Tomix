import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { Budget } from './components/budget/budget';
import { Login } from './components/login/login';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'login', component: Login },
    { path: 'dashboard', component: Dashboard },
    { path: 'budget', component: Budget },
    { path: 'loans', loadComponent: () => import('./components/loans/loans').then(m => m.Loans) },
    { path: 'credit-cards', loadComponent: () => import('./components/credit-cards/credit-cards').then(m => m.CreditCards) },
    { path: 'subscriptions', loadComponent: () => import('./components/subscriptions/subscriptions').then(m => m.Subscriptions) },
    { 
        path: 'investments', 
        loadComponent: () => import('./components/investments/investments').then(m => m.Investments),
        children: [
            { path: '', redirectTo: 'gold', pathMatch: 'full' },
            { path: 'gold', loadComponent: () => import('./components/investments/gold-silver/gold-silver').then(m => m.GoldSilver) },
            { path: 'post-office', loadComponent: () => import('./components/investments/post-office/post-office').then(m => m.PostOffice) },
            { path: 'mutual-funds', loadComponent: () => import('./components/investments/mutual-funds/mutual-funds').then(m => m.MutualFunds) },

        ]
    }
];
