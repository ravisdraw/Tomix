import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: '<div class="flex items-center justify-center h-screen"><p>Authenticating...</p></div>',
})
export class AuthCallback implements OnInit {
  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit() {
    // The session will be automatically set by Supabase
    // Just wait a moment for the session to be established, then redirect
    setTimeout(() => {
      const session = this.authService.getSession();
      if (session) {
        this.router.navigate(['/dashboard']);
      } else {
        // If no session, go back to login
        this.router.navigate(['/login']);
      }
    }, 1000);
  }
}
