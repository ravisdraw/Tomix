import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface CreditCard {
  id?: string;
  user_id: string;
  card_name: string;
  last_four_digits: string;
  card_limit: number;
  utilized_amount: number;
  billing_cycle_day: number;
  due_date: string;
  due_amount: number;
  month_year: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CreditCardsService {
  private supabaseService = inject(SupabaseService);

  /**
   * Get all credit cards for a specific user
   */
  async getCreditCards(userId: string): Promise<CreditCard[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from('credit_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching credit cards:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get credit cards for a specific month and year
   */
  async getCreditCardsByMonth(monthYear: string, userId: string): Promise<CreditCard[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from('credit_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching credit cards by month:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get credit cards for multiple months (for reporting)
   */
  async getCreditCardsByDateRange(monthYears: string[], userId: string): Promise<CreditCard[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from('credit_cards')
      .select('*')
      .eq('user_id', userId)
      .in('month_year', monthYears)
      .order('month_year', { ascending: true });

    if (error) {
      console.error('Error fetching credit cards by date range:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Create a new credit card
   */
  async createCreditCard(creditCard: Omit<CreditCard, 'id' | 'created_at' | 'updated_at'>): Promise<CreditCard> {
    const { data, error } = await this.supabaseService.getClient()
      .from('credit_cards')
      .insert([creditCard])
      .select()
      .single();

    if (error) {
      console.error('Error creating credit card:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update an existing credit card
   */
  async updateCreditCard(
    id: string,
    updates: Partial<Omit<CreditCard, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<CreditCard> {
    const { data, error } = await this.supabaseService.getClient()
      .from('credit_cards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating credit card:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a credit card
   */
  async deleteCreditCard(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from('credit_cards')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting credit card:', error);
      throw error;
    }
  }

  /**
   * Get a single credit card by ID
   */
  async getCreditCardById(id: string): Promise<CreditCard | null> {
    const { data, error } = await this.supabaseService.getClient()
      .from('credit_cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching credit card by ID:', error);
      return null;
    }

    return data;
  }
}
