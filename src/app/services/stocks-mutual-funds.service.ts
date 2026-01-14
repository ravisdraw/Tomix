import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface StockMutualFund {
  id?: string;
  user_id: string;
  fund_id: string;
  fund_name: string;
  fund_type: 'Mutual Fund' | 'Stock';
  quantity: number;
  bought_price: number;
  current_price: number;
  invested_amount?: number;
  current_value?: number;
  profit_loss?: number;
  profit_loss_percentage?: number;
  purchase_date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FundSummary {
  user_id: string;
  fund_id: string;
  fund_name: string;
  fund_type: 'Mutual Fund' | 'Stock';
  total_quantity: number;
  avg_bought_price: number;
  current_price: number;
  total_invested: number;
  total_current_value: number;
  total_profit_loss: number;
  profit_loss_percentage: number;
  first_purchase_date: string;
  last_purchase_date: string;
  transaction_count: number;
}

@Injectable({
  providedIn: 'root',
})
export class StocksMutualFundsService {
  private supabase = inject(SupabaseService);

  /**
   * Get all investments for a user
   */
  async getAllInvestments(userId: string): Promise<StockMutualFund[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds')
      .select('*')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get investments grouped by fund_id (summary view)
   */
  async getFundsSummary(userId: string): Promise<FundSummary[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds_summary')
      .select('*')
      .eq('user_id', userId)
      .order('fund_name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get all transactions for a specific fund
   */
  async getFundTransactions(userId: string, fundId: string): Promise<StockMutualFund[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds')
      .select('*')
      .eq('user_id', userId)
      .eq('fund_id', fundId)
      .order('purchase_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Add a new investment
   */
  async addInvestment(investment: Omit<StockMutualFund, 'id' | 'created_at' | 'updated_at'>): Promise<StockMutualFund> {
    const { data, error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds')
      .insert([investment])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an existing investment
   */
  async updateInvestment(
    id: string,
    updates: Partial<Omit<StockMutualFund, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<StockMutualFund> {
    const { data, error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update current price for all investments of a specific fund
   */
  async updateFundCurrentPrice(userId: string, fundId: string, currentPrice: number): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds')
      .update({ current_price: currentPrice })
      .eq('user_id', userId)
      .eq('fund_id', fundId);

    if (error) throw error;
  }

  /**
   * Delete an investment
   */
  async deleteInvestment(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Delete all transactions for a specific fund
   */
  async deleteFund(userId: string, fundId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds')
      .delete()
      .eq('user_id', userId)
      .eq('fund_id', fundId);

    if (error) throw error;
  }

  /**
   * Generate a unique fund_id
   */
  generateFundId(fundType: 'Mutual Fund' | 'Stock', fundName: string): string {
    const prefix = fundType === 'Mutual Fund' ? 'MF' : 'STK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const nameCode = fundName
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 4)
      .toUpperCase();
    
    return `${prefix}-${nameCode}-${timestamp}-${random}`;
  }

  /**
   * Check if a fund_id already exists
   */
  async fundIdExists(userId: string, fundId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .getClient()
      .from('stocks_mutual_funds')
      .select('id')
      .eq('user_id', userId)
      .eq('fund_id', fundId)
      .limit(1);

    if (error) throw error;
    return (data?.length || 0) > 0;
  }

  /**
   * Get investment statistics
   */
  async getInvestmentStats(userId: string): Promise<{
    totalInvested: number;
    totalCurrentValue: number;
    totalProfitLoss: number;
    totalProfitLossPercentage: number;
    mutualFundsCount: number;
    stocksCount: number;
  }> {
    const summary = await this.getFundsSummary(userId);

    const stats = summary.reduce(
      (acc, fund) => {
        acc.totalInvested += fund.total_invested;
        acc.totalCurrentValue += fund.total_current_value;
        acc.totalProfitLoss += fund.total_profit_loss;
        
        if (fund.fund_type === 'Mutual Fund') {
          acc.mutualFundsCount++;
        } else {
          acc.stocksCount++;
        }
        
        return acc;
      },
      {
        totalInvested: 0,
        totalCurrentValue: 0,
        totalProfitLoss: 0,
        totalProfitLossPercentage: 0,
        mutualFundsCount: 0,
        stocksCount: 0,
      }
    );

    stats.totalProfitLossPercentage =
      stats.totalInvested > 0 ? (stats.totalProfitLoss / stats.totalInvested) * 100 : 0;

    return stats;
  }
}
