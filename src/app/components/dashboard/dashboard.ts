import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

const ADMIN_ID = "92fc084c-9ddb-4964-bf5b-2de5868aa83c";
const SECRET_PIN = '9218';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  showPinModal = signal<boolean>(false);
  enteredPin = '';
  pinError = false;

  constructor(private authService: AuthService, private router: Router) {}

  async ngOnInit() {
    // Check if user is the admin with the specific ID
    if(sessionStorage.getItem('isAdmin') === 'true') {
      this.showPinModal.set(false);
      return;
    }
    const userId = localStorage.getItem('userId');
    if (userId === ADMIN_ID) {
      this.showPinModal.set(true);
    }
  }

  submitPin() {
    if (this.enteredPin === SECRET_PIN) {
      this.showPinModal.set(false);
      this.enteredPin = '';
      this.pinError = false;
      sessionStorage.setItem('isAdmin', 'true');
    } else {
      this.pinError = true;
      this.enteredPin = '';
      setTimeout(() => {
        this.logout();
      }, 1500);
    }
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.submitPin();
    }
  }
}
