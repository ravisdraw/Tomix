import { CommonModule } from '@angular/common';
import { Component, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '@supabase/supabase-js';

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

  constructor(private router: Router, private authService: AuthService) {}

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

}
