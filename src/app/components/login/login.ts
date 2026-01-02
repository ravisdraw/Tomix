import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login implements OnInit, OnDestroy {
  isLoading = false;
  errorMessage = '';
  private destroy$ = new Subject<void>();

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    // Check if user is already logged in
    const session = this.authService.getSession();
    if (session) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Listen for session changes (after OAuth callback)
    this.authService.session$.pipe(takeUntil(this.destroy$)).subscribe((session) => {
      if (session) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  async signInWithGoogle() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      await this.authService.signInWithGoogle();
      // Redirect will happen automatically after OAuth callback via session listener
    } catch (error: any) {
      this.errorMessage = error.message || 'Failed to sign in with Google';
      this.isLoading = false;
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
