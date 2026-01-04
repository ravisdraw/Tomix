import { CommonModule } from '@angular/common';
import { Component, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '@supabase/supabase-js';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

interface NavSection {
  label: string;
  isCollapsed: boolean;
  items: NavItem[];
}

@Component({
  selector: 'app-side-nav',
  imports: [CommonModule],
  templateUrl: './side-nav.html',
  styleUrl: './side-nav.css',
})
export class SideNav implements OnInit {

  selectedNavItem = signal('');
  user = signal<User | null>(null);
  userName = signal<string>('');
  userAvatar = signal<string>('');
  sideNavItems = signal<Record<string, NavSection>>({
    'debts': {
      label: 'Debts',
      isCollapsed: false,
      items: [
        { label: 'Loans', path: 'loans', icon: 'bx bx-home-alt' },
        { label: 'Credit Cards', path: '', icon: 'bx bx-receipt' },
        { label: 'Subscriptions', path: '', icon: 'bx bx-credit-card' },
      ]
    },
    'investments': {
      label: 'Investments',
      isCollapsed: true,
      items: [
        { label: 'Gold', path: '', icon: 'bx bx-treasure-chest' },
        { label: 'Post Office', path: '', icon: 'bx bx-bank' },
        { label: 'Mutual Funds', path: '', icon: 'bx bx-file-report' },
        { label: 'Stocks', path: '', icon: 'bx bx-chart-trend' },
      ]
    },
    'insurance': {
      label: 'Insurance',
      isCollapsed: true, 
      items: [
        { label: 'Health', path: '', icon: 'bx bx-heart' },
        { label: 'Vehicle', path: '', icon: 'bx bx-car' },
        { label: 'Term Life', path: '', icon: 'bx bx-shield-quarter' },
      ]
    },
    'savings': {
      label: 'Savings',
      isCollapsed: true,
      items : [
        { label: 'Short Term Goals', path: '', icon: 'bx bx-wallet' },
        { label: 'Long Term Goals', path: '', icon: 'bx bx-piggy-bank' },
        { label: 'Emergency Fund', path: '', icon: 'bx bx-band-aid' },
        { label: 'Family Savings', path: '', icon: 'bx bx-briefcase-alt-2' },
      ]
    }
  });

  constructor(private router: Router, private authService: AuthService) { }

  async ngOnInit() {
    // Get current user from session
    const session = this.authService.getSession();
    if (session?.user) {
      this.user.set(session.user);
      this.userName.set(session.user.user_metadata?.['full_name'] || session.user.email || 'User');
      this.userAvatar.set(session.user.user_metadata?.['avatar_url'] || '');
    }

    // Listen for session changes
    this.authService.session$.subscribe((session) => {
      if (session?.user) {
        this.user.set(session.user);
        this.userName.set(session.user.user_metadata?.['full_name'] || session.user.email || 'User');
        this.userAvatar.set(session.user.user_metadata?.['avatar_url'] || '');
      }
    });
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
    this.selectedNavItem.set(path);
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  handleCollapse(section: string) {
    const currentItems = this.sideNavItems();
    currentItems[section].isCollapsed = !currentItems[section].isCollapsed;
    this.sideNavItems.set({ ...currentItems });
  }
}
