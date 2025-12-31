import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase: SupabaseClient;
  private sessionSubject = new BehaviorSubject<Session | null>(null);
  public session$: Observable<Session | null> = this.sessionSubject.asObservable();

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    this.initializeSession();
  }

  /**
   * Initialize session from stored data
   */
  private async initializeSession() {
    const { data } = await this.supabase.auth.getSession();
    this.sessionSubject.next(data?.session || null);

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.sessionSubject.next(session);
    });
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    const redirectUrl = `${window.location.origin}/dashboard`;

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) throw new Error(`Google sign-in failed: ${error.message}`);
    return data;
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    const { data } = await this.supabase.auth.getUser();
    return data?.user;
  }

  /**
   * Get current session
   */
  getSession(): Session | null {
    return this.sessionSubject.value;
  }

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw new Error(`Sign out failed: ${error.message}`);
  }

  /**
   * Update user profile (after signup with Google)
   */
  async updateUserProfile(updates: {
    full_name?: string;
    avatar_url?: string;
  }) {
    const { data, error } = await this.supabase.auth.updateUser({
      data: updates,
    });

    if (error) throw new Error(`Profile update failed: ${error.message}`);
    return data;
  }
}
