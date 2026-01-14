import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Subscription {
  id?: string;
  user_id?: string;
  name: string;
  emoji?: string;
  plan_details?: string;
  billing_amount: number;
  billing_date: number; // Day of month (1-31)
  billing_cycle?: string; // monthly, yearly, quarterly
  start_date: string;
  end_date?: string;
  is_active?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionsService {
  private supabaseService = inject(SupabaseService);
  private supabase = this.supabaseService.getClient();

  /**
   * Get all subscriptions for a user
   */
  async getSubscriptions(userId: string): Promise<Subscription[]> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('billing_date', { ascending: true });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get active subscriptions for a user
   */
  async getActiveSubscriptions(userId: string): Promise<Subscription[]> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('billing_date', { ascending: true });

    if (error) {
      console.error('Error fetching active subscriptions:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get a single subscription by ID
   */
  async getSubscription(id: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching subscription:', error);
      throw error;
    }

    return data;
  }

  /**
   * Create a new subscription
   */
  async createSubscription(subscription: Subscription): Promise<Subscription> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .insert([subscription])
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(id: string, subscription: Partial<Subscription>): Promise<Subscription> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .update(subscription)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting subscription:', error);
      throw error;
    }
  }

  /**
   * Calculate days left until next billing
   */
  calculateDaysLeft(billingDate: number): number {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let nextBillingDate: Date;

    if (currentDay <= billingDate) {
      // Next billing is this month
      nextBillingDate = new Date(currentYear, currentMonth, billingDate);
    } else {
      // Next billing is next month
      nextBillingDate = new Date(currentYear, currentMonth + 1, billingDate);
    }

    const diffTime = nextBillingDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Check if subscription has ended
   */
  isSubscriptionActive(endDate?: string): boolean {
    if (!endDate) return true;

    const today = new Date();
    const end = new Date(endDate);
    
    return end >= today;
  }

  /**
   * Calculate monthly total of all active subscriptions
   */
  calculateMonthlyTotal(subscriptions: Subscription[]): number {
    return subscriptions
      .filter((sub) => sub.is_active !== false)
      .reduce((sum, sub) => {
        if (sub.billing_cycle === 'yearly') {
          return sum + (sub.billing_amount / 12);
        } else if (sub.billing_cycle === 'quarterly') {
          return sum + (sub.billing_amount / 3);
        }
        return sum + sub.billing_amount;
      }, 0);
  }

  /**
   * Get upcoming subscriptions (within next 7 days)
   */
  getUpcomingSubscriptions(subscriptions: Subscription[]): Subscription[] {
    return subscriptions.filter((sub) => {
      const daysLeft = this.calculateDaysLeft(sub.billing_date);
      return daysLeft >= 0 && daysLeft <= 7;
    });
  }
}
