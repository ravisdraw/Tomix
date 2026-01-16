import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../services/supabase.service';
import {
  StocksMutualFundsService,
  StockMutualFund,
  FundSummary,
} from '../../../services/stocks-mutual-funds.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { AppDataStore } from '../../../store/app-data.store';

@Component({
  selector: 'app-mutual-funds',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './mutual-funds.html',
  styleUrl: './mutual-funds.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MutualFunds implements OnInit {
  showAddInvestment = signal(false);
  investmentForm: any;
  editingInvestmentId = signal<string | null>(null);
  isCheckingData = signal(true);
  userId = signal<string | null>(null);
  fundsSummary = signal<FundSummary[]>([]);
  selectedFundTransactions = signal<StockMutualFund[]>([]);
  showTransactionsForFund = signal<string | null>(null);
  isLoadingTransactions = signal(false);
  isAddingToExistingFund = signal(false);
  selectedExistingFundId = signal<string | null>(null);
  availableFunds = signal<FundSummary[]>([]);

  supabaseService = inject(SupabaseService);
  stocksMutualFundsService = inject(StocksMutualFundsService);
  appDataStore = inject(AppDataStore);

  investmentStats = computed(() => {
    const summary = this.fundsSummary();
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
  });

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.authService.session$.subscribe((session) => {
      if (!session) this.router.navigate(['/login']);
    });

    this.investmentForm = this.fb.group({
      fund_name: ['', Validators.required],
      fund_type: ['Mutual Fund', Validators.required],
      quantity: [0, [Validators.required, Validators.min(0.0001)]],
      bought_price: [0, [Validators.required, Validators.min(0.01)]],
      current_price: [0, [Validators.required, Validators.min(0.01)]],
      purchase_date: ['', Validators.required],
      notes: [''],
      existing_fund_id: [''],
    });
  }

  async ngOnInit() {
    try {
      const user = await this.supabaseService.getCurrentUser();
      if (user) {
        this.userId.set(user.id);
        await this.loadFundsSummary(user.id);
      }
    } catch (err) {
      console.error('Failed to get user:', err);
      const demoUserId = this.getOrCreateDemoUserId();
      this.userId.set(demoUserId);
      await this.loadFundsSummary(demoUserId);
    }
  }

  private getOrCreateDemoUserId(): string {
    const storageKey = 'demo-user-id';
    let userId = localStorage.getItem(storageKey);

    if (!userId) {
      userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      localStorage.setItem(storageKey, userId);
    }

    return userId;
  }

  private async loadFundsSummary(userId: string) {
    this.isCheckingData.set(true);

    if (!userId) return;

    try {
      // Check if data already loaded in store for this user
      if (this.appDataStore.mutualFundsLoaded() && this.appDataStore.currentUserId() === userId) {
        // Use existing data from store
        const summary = this.appDataStore.mutualFunds();
        this.fundsSummary.set(summary);
        this.availableFunds.set(summary);
        console.log('Using cached mutual funds data');
      } else {
        // Load from store (which will fetch from API if needed)
        await this.appDataStore.loadMutualFunds(userId);
        const summary = this.appDataStore.mutualFunds();
        this.fundsSummary.set(summary);
        this.availableFunds.set(summary);
      }
    } catch (error) {
      console.error('Error loading funds summary:', error);
    } finally {
      this.isCheckingData.set(false);
    }
  }

  openAddInvestment() {
    this.showAddInvestment.set(true);
    this.isAddingToExistingFund.set(false);
    this.selectedExistingFundId.set(null);
    this.investmentForm.reset({
      fund_type: 'Mutual Fund',
      quantity: 0,
      bought_price: 0,
      current_price: 0,
      purchase_date: new Date().toISOString().split('T')[0],
    });
  }

  closeAddInvestment() {
    this.showAddInvestment.set(false);
    this.editingInvestmentId.set(null);
    this.isAddingToExistingFund.set(false);
    this.selectedExistingFundId.set(null);
    this.investmentForm.reset();
  }

  onAddToExistingChange() {
    const addToExisting = this.isAddingToExistingFund();
    if (addToExisting) {
      this.investmentForm.get('fund_name')?.disable();
      this.investmentForm.get('fund_type')?.disable();
    } else {
      this.investmentForm.get('fund_name')?.enable();
      this.investmentForm.get('fund_type')?.enable();
      this.selectedExistingFundId.set(null);
    }
  }

  onExistingFundSelect() {
    const selectedFundId = this.investmentForm.get('existing_fund_id')?.value;
    if (selectedFundId) {
      const fund = this.availableFunds().find((f) => f.fund_id === selectedFundId);
      if (fund) {
        this.selectedExistingFundId.set(fund.fund_id);
        this.investmentForm.patchValue({
          fund_name: fund.fund_name,
          fund_type: fund.fund_type,
          current_price: fund.current_price,
        });
      }
    }
  }

  async submitInvestment() {
    if (this.investmentForm.invalid) {
      Object.keys(this.investmentForm.controls).forEach((key) => {
        this.investmentForm.controls[key].markAsTouched();
      });
      return;
    }

    const userId = this.userId();
    if (!userId) return;

    try {
      const formValue = this.investmentForm.getRawValue();
      
      let fundId: string;
      
      if (this.isAddingToExistingFund() && this.selectedExistingFundId()) {
        fundId = this.selectedExistingFundId()!;
      } else {
        // Generate new fund_id
        fundId = this.stocksMutualFundsService.generateFundId(
          formValue.fund_type,
          formValue.fund_name
        );
      }

      const investment: Omit<StockMutualFund, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        fund_id: fundId,
        fund_name: formValue.fund_name,
        fund_type: formValue.fund_type,
        quantity: parseFloat(formValue.quantity),
        bought_price: parseFloat(formValue.bought_price),
        current_price: parseFloat(formValue.current_price),
        purchase_date: formValue.purchase_date,
        notes: formValue.notes || '',
      };

      if (this.editingInvestmentId()) {
        await this.stocksMutualFundsService.updateInvestment(
          this.editingInvestmentId()!,
          investment
        );
      } else {
        await this.stocksMutualFundsService.addInvestment(investment);
      }

      if (userId) {
        await this.loadFundsSummary(userId);
      }
      
      // Reload transactions if viewing a fund's transactions
      if (this.showTransactionsForFund()) {
        await this.loadFundTransactions(this.showTransactionsForFund()!);
      }
      
      this.closeAddInvestment();
    } catch (error) {
      console.error('Error saving investment:', error);
      alert('Failed to save investment. Please try again.');
    }
  }

  async showFundTransactions(fund: FundSummary) {
    this.showTransactionsForFund.set(fund.fund_id);
    await this.loadFundTransactions(fund.fund_id);
  }

  async loadFundTransactions(fundId: string) {
    this.isLoadingTransactions.set(true);
    const userId = this.userId();

    if (!userId) return;

    try {
      const transactions = await this.stocksMutualFundsService.getFundTransactions(userId, fundId);
      this.selectedFundTransactions.set(transactions);
    } catch (error) {
      console.error('Error loading fund transactions:', error);
    } finally {
      this.isLoadingTransactions.set(false);
    }
  }

  async updateFundPrice(fund: FundSummary) {
    const newPrice = prompt(`Enter new current price for ${fund.fund_name}:`, fund.current_price.toString());
    
    if (newPrice === null) return;
    
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      alert('Please enter a valid price');
      return;
    }

    const userId = this.userId();
    if (!userId) return;

    try {
      await this.stocksMutualFundsService.updateFundCurrentPrice(userId, fund.fund_id, price);
      await this.loadFundsSummary(userId);
      
      if (this.showTransactionsForFund() === fund.fund_id) {
        await this.loadFundTransactions(fund.fund_id);
      }
    } catch (error) {
      console.error('Error updating fund price:', error);
      alert('Failed to update price. Please try again.');
    }
  }

  async deleteTransaction(transactionId: string) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const userId = this.userId();
      await this.stocksMutualFundsService.deleteInvestment(transactionId);
      if (userId) {
        await this.loadFundsSummary(userId);
      }
      
      if (this.showTransactionsForFund()) {
        await this.loadFundTransactions(this.showTransactionsForFund()!);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  }

  async deleteFund(fund: FundSummary) {
    if (!confirm(`Are you sure you want to delete all transactions for ${fund.fund_name}?`)) return;

    const userId = this.userId();
    if (!userId) return;

    try {
      await this.stocksMutualFundsService.deleteFund(userId, fund.fund_id);
      
      if (this.showTransactionsForFund() === fund.fund_id) {
        this.showTransactionsForFund.set(null);
        this.selectedFundTransactions.set([]);
      }
      
      await this.loadFundsSummary(userId);
    } catch (error) {
      console.error('Error deleting fund:', error);
      alert('Failed to delete fund. Please try again.');
    }
  }

  formatIndianRupee(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getProfitLossClass(value: number): string {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  }

  getFundTypeIcon(type: 'Mutual Fund' | 'Stock'): string {
    return type === 'Mutual Fund' ? 'bx-line-chart' : 'bx-trending-up';
  }

  getFundTypeColor(type: 'Mutual Fund' | 'Stock'): string {
    return type === 'Mutual Fund' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600';
  }
}
