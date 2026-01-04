import { Injectable } from '@angular/core';
import { SupabaseService } from '../supabase.service';

export interface LoanRecord {
  id: string;
  user_id: string;
  loan_name: string;
  amount: number;
  interest: number;
  tenure: number; // in months
  monthly_due_date: number; // day of month (1-31)
  emoji: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LoansService {
  private readonly tableName = 'loans';

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Save a new loan to Supabase
   */
  async saveLoan(loan: Omit<LoanRecord, 'id' | 'created_at' | 'updated_at'>): Promise<LoanRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .insert([loan])
      .select()
      .single();

    if (error) throw new Error(`Failed to save loan: ${error.message}`);
    return data;
  }

  /**
   * Update an existing loan
   */
  async updateLoan(id: string, updates: Partial<LoanRecord>): Promise<LoanRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update loan: ${error.message}`);
    return data;
  }

  /**
   * Delete a loan
   */
  async deleteLoan(id: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete loan: ${error.message}`);
  }

  /**
   * Get all loans for a specific user
   */
  async getLoansByUser(userId: string): Promise<LoanRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch loans: ${error.message}`);
    return data || [];
  }

  /**
   * Get a single loan by ID
   */
  async getLoanById(id: string): Promise<LoanRecord> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Failed to fetch loan: ${error.message}`);
    return data;
  }
}
