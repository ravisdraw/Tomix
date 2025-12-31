import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface BudgetRecord {
  id: string;
  user_id: string;
  month_year: string;
  expense_name: string;
  emoji: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  bank_account: string;
  carry_forward?: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BudgetEntriesService {
  private readonly tableName = 'budget_entries';

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Save a budget entry to Supabase
   */
  async saveBudgetEntry(entry: Omit<BudgetRecord, 'id' | 'created_at' | 'updated_at'>): Promise<BudgetRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .insert([entry])
      .select()
      .single();

    if (error) throw new Error(`Failed to save entry: ${error.message}`);
    return data;
  }

  /**
   * Update an existing budget entry
   */
  async updateBudgetEntry(id: string, updates: Partial<BudgetRecord>): Promise<BudgetRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update entry: ${error.message}`);
    return data;
  }

  /**
   * Delete a budget entry
   */
  async deleteBudgetEntry(id: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete entry: ${error.message}`);
  }

  /**
   * Get all budget entries for a specific month-year
   */
  async getBudgetEntriesByMonth(monthYear: string, userId: string): Promise<BudgetRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .select('*')
      .eq('month_year', monthYear)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch entries: ${error.message}`);
    return data || [];
  }

  /**
   * Get all budget entries within a date range
   */
  async getBudgetEntriesByDateRange(
    startDate: string,
    endDate: string,
    userId: string
  ): Promise<BudgetRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch entries by date range: ${error.message}`);
    return data || [];
  }
}
