import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ExpenseCategory {
  id: string;
  user_id: string;
  category_name: string;
  emoji: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExpenseCategoriesService {
  private readonly tableName = 'expense_categories';

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Get all expense categories for a user
   */
  async getExpenseCategories(userId: string): Promise<ExpenseCategory[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('category_name', { ascending: true });

    if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
    return data || [];
  }

  /**
   * Create a new expense category
   */
  async createExpenseCategory(
    category: Omit<ExpenseCategory, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ExpenseCategory> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .insert([category])
      .select()
      .single();

    if (error) throw new Error(`Failed to create category: ${error.message}`);
    return data;
  }

  /**
   * Get a category by name
   */
  async getExpenseCategoryByName(userId: string, categoryName: string): Promise<ExpenseCategory | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('category_name', categoryName)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch category: ${error.message}`);
    }
    return data || null;
  }

  /**
   * Delete an expense category
   */
  async deleteExpenseCategory(categoryId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from(this.tableName)
      .delete()
      .eq('id', categoryId);

    if (error) throw new Error(`Failed to delete category: ${error.message}`);
  }
}
