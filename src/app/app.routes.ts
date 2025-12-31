import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { Budget } from './components/budget/budget';
import { Login } from './components/login/login';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: Login },
    { path: 'dashboard', component: Dashboard },
    { path: 'budget', component: Budget }
];
