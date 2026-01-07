import { Component, HostListener, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SideNav } from "./components/side-nav/side-nav";
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SideNav, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('tomix');
  protected currentUrl = signal<string>('');
  protected openSideNav = signal<boolean>(true);

  constructor(public router: Router) {
    // Set initial URL
    this.currentUrl.set(this.router.url);

    // Listen for route changes
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentUrl.set(event.url);
      });
  }

  isLoginPage(): boolean {
    return this.router.url.includes('login');
  }

  
  @HostListener('window:resize')
  onWindowResize() {
    // Open menu on larger screen
    if (window.innerWidth >= 768) {
      this.openSideNav.set(true);
    }
  }

  toggleSideNav() {
    this.openSideNav.update(val => !val);
  }

  closeSideNav() {
    if (window.innerWidth < 768) {
      this.openSideNav.set(false);
    }
  }

  protected window = window;
}

