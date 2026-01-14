import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface GoldInvestment {
  id?: string;
  user_id?: string;
  plan_id?: string;
  plan_name: string;
  monthly_amount: number;
  investment_type: 'gold' | 'silver';
  gold_rate?: number;
  paid_date?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GoldInvestmentsService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Get all gold investments for a specific user
   */
  async getGoldInvestments(userId: string): Promise<GoldInvestment[]> {
    const { data, error } = await this.supabase.getClient()
      .from('gold_investments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching gold investments:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get all unique plans (grouped by plan_id)
   */
  async getPlans(userId: string): Promise<GoldInvestment[]> {
    const { data, error } = await this.supabase.getClient()
      .from('gold_investments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching plans:', error);
      throw error;
    }

    // Get unique plans by plan_id
    const uniquePlans = new Map<string, GoldInvestment>();
    (data || []).forEach(investment => {
      if (investment.plan_id && !uniquePlans.has(investment.plan_id)) {
        uniquePlans.set(investment.plan_id, investment);
      }
    });

    return Array.from(uniquePlans.values());
  }



  /**
   * Get investment history for a specific plan_id
   */
  async getInvestmentHistory(userId: string, planId: string): Promise<GoldInvestment[]> {
    const { data, error } = await this.supabase.getClient()
      .from('gold_investments')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching investment history:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Add a new gold investment
   */
  async addGoldInvestment(investment: GoldInvestment): Promise<GoldInvestment> {
    const { data, error } = await this.supabase.getClient()
      .from('gold_investments')
      .insert([investment])
      .select()
      .single();

    if (error) {
      console.error('Error adding gold investment:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update a gold investment
   */
  async updateGoldInvestment(id: string, updates: Partial<GoldInvestment>): Promise<GoldInvestment> {
    const { data, error } = await this.supabase.getClient()
      .from('gold_investments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating gold investment:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete a gold investment
   */
  async deleteGoldInvestment(id: string): Promise<void> {
    const { error } = await this.supabase.getClient()
      .from('gold_investments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting gold investment:', error);
      throw error;
    }
  }

  /**
   * Delete all monthly entries linked to a template
   */
  async deleteTemplateAndEntries(templateId: string): Promise<void> {
    // First delete all monthly entries
    const { error: entriesError } = await this.supabase.getClient()
      .from('gold_investments')
      .delete()
      .eq('template_id', templateId);

    if (entriesError) {
      console.error('Error deleting template entries:', entriesError);
      throw entriesError;
    }

    // Then delete the template itself
    const { error: templateError } = await this.supabase.getClient()
      .from('gold_investments')
      .delete()
      .eq('id', templateId);

    if (templateError) {
      console.error('Error deleting template:', templateError);
      throw templateError;
    }
  }
}
