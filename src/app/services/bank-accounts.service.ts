import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface BankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  balance: number;
  after_expense_paid: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class BankAccountsService {
  private readonly tableName = 'bank_accounts';

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Get all bank accounts for a user
   */
  async getBankAccounts(userId: string): Promise<BankAccount[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch bank accounts: ${error.message}`);
    return data || [];
  }

  /**
   * Create a new bank account
   */
  async createBankAccount(
    account: Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>
  ): Promise<BankAccount> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .insert([account])
      .select()
      .single();

    if (error) throw new Error(`Failed to create bank account: ${error.message}`);
    return data;
  }

  /**
   * Update an existing bank account
   */
  async updateBankAccount(id: string, updates: Partial<BankAccount>): Promise<BankAccount> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update bank account: ${error.message}`);
    return data;
  }

  // Update an after_expense_paid field specifically
  async updateAfterExpensePaid(id: string, afterExpensePaid: number): Promise<BankAccount> {
    const { data, error } = await this.supabaseService 
      .getClient()
      .from(this.tableName)
      .update({ after_expense_paid: afterExpensePaid })
      .eq('id', id)
      .select()
      .single();  
    if (error) throw new Error(`Failed to update after_expense_paid: ${error.message}`);
    return data;
  }

  /**
   * Delete a bank account
   */
  async deleteBankAccount(id: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete bank account: ${error.message}`);
  }
}
