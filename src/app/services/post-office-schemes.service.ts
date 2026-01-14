import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PostOfficeScheme {
  id?: string;
  user_id?: string;
  scheme_id?: string;
  scheme_name: string;
  interest_rate: number;
  principal_amount: number;
  maturity_months: number;
  paid_date: string;
  maturity_date?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PostOfficeSchemesService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Get all post office schemes for a specific user
   */
  async getPostOfficeSchemes(userId: string): Promise<PostOfficeScheme[]> {
    const { data, error } = await this.supabase.getClient()
      .from('post_office_schemes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching post office schemes:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get scheme history by scheme_id
   */
  async getSchemeHistory(userId: string, schemeId: string): Promise<PostOfficeScheme[]> {
    const { data, error } = await this.supabase.getClient()
      .from('post_office_schemes')
      .select('*')
      .eq('user_id', userId)
      .eq('scheme_id', schemeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching scheme history:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Add a new post office scheme
   */
  async addPostOfficeScheme(scheme: PostOfficeScheme): Promise<PostOfficeScheme> {
    const { data, error } = await this.supabase.getClient()
      .from('post_office_schemes')
      .insert([scheme])
      .select()
      .single();

    if (error) {
      console.error('Error adding post office scheme:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update a post office scheme
   */
  async updatePostOfficeScheme(id: string, updates: Partial<PostOfficeScheme>): Promise<PostOfficeScheme> {
    const { data, error } = await this.supabase.getClient()
      .from('post_office_schemes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating post office scheme:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a post office scheme
   */
  async deletePostOfficeScheme(id: string): Promise<void> {
    const { error } = await this.supabase.getClient()
      .from('post_office_schemes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting post office scheme:', error);
      throw error;
    }
  }

  /**
   * Calculate maturity amount with compound interest
   */
  calculateMaturityAmount(principal: number, rate: number, months: number): number {
    const years = months / 12;
    const amount = principal * Math.pow((1 + rate / 100), years);
    return Math.round(amount * 100) / 100;
  }
}
