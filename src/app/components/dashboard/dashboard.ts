import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { CreditCardsService, CreditCard } from '../../services/credit-cards.service';
import { SubscriptionsService, Subscription } from '../../services/subscriptions.service';
import { GoldInvestmentsService, GoldInvestment } from '../../services/gold-investments.service';
import { StocksMutualFundsService, FundSummary } from '../../services/stocks-mutual-funds.service';
import { PostOfficeSchemesService, PostOfficeScheme } from '../../services/post-office-schemes.service';
import { BarChartComponent } from '../../charts/bar-chart/bar-chart';
import { DoughnutChartComponent } from '../../charts/doughnut-chart/doughnut-chart';
import { AppDataStore } from '../../store/app-data.store';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface Loan {
  id?: string | number;
  loan_name?: string;
  loanName?: string;
  monthly_emi?: number;
  monthlyEMI?: number;
  interest?: number;
  total_tenure?: number;
  totalTenure?: number;
  paid_months?: number;
  paidMonths?: number;
  emoji?: string;
  monthly_due_date?: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    BarChartComponent,
    DoughnutChartComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  supabaseService = inject(SupabaseService);
  subscriptionsService = inject(SubscriptionsService);
  appDataStore = inject(AppDataStore);

  userId = signal<string | null>(null);
  isLoading = signal(true);
  
  // Derived signals from store
  budgetEntries = computed(() => this.appDataStore.budgetEntries());
  loans = computed(() => this.appDataStore.loans());
  creditCards = computed(() => this.appDataStore.creditCards());
  subscriptions = computed(() => this.appDataStore.subscriptions());
  goldInvestments = computed(() => this.appDataStore.goldInvestments());
  mutualFunds = computed(() => this.appDataStore.mutualFunds());
  postOfficeSchemes = computed(() => this.appDataStore.postOfficeSchemes());

  monthlyBudgetData = signal<Map<string, { income: number; expenses: number; savings: number }>>(new Map());

  // Last 5 months data
  last5Months = computed(() => {
    const months = [];
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 4; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const key = `${monthName}${year}`;
      const label = `${monthName} ${year}`;
      
      const data = this.monthlyBudgetData().get(key) || { income: 0, expenses: 0, savings: 0 };
      
      months.push({
        key,
        label,
        income: data.income,
        expenses: data.expenses,
        savings: data.savings
      });
    }
    
    return months;
  });

  // Average calculations
  averageIncome = computed(() => {
    const months = this.last5Months();
    const total = months.reduce((sum, m) => sum + m.income, 0);
    return total / (months.length || 1);
  });

  averageExpenses = computed(() => {
    const months = this.last5Months();
    const total = months.reduce((sum, m) => sum + m.expenses, 0);
    return total / (months.length || 1);
  });

  averageSavings = computed(() => {
    return this.averageIncome() - this.averageExpenses();
  });

  // Computed values for Budget (current totals from all loaded data)
  monthlyIncome = computed(() => {
    const entries = this.budgetEntries();
    return entries
      .filter((e) => e.type === 'income')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  });

  monthlyExpenses = computed(() => {
    const entries = this.budgetEntries();
    return entries
      .filter((e) => e.type === 'expense')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  });

  monthlySavings = computed(() => {
    return this.monthlyIncome() - this.monthlyExpenses();
  });

  // Computed values for Loans
  totalDebt = computed(() => {
    const loans = this.loans();
    if (!loans || loans.length === 0) return 0;
    
    return loans.reduce((sum, loan) => {
      if (!loan) return sum;
      
      const monthlyEMI = (loan as any).monthly_emi || (loan as any).monthlyEMI || 0;
      const interest = loan.interest || 0;
      const totalTenure = (loan as any).total_tenure || (loan as any).totalTenure || 0;
      const paidMonths = (loan as any).paid_months || (loan as any).paidMonths || 0;
      
      if (!monthlyEMI || !totalTenure) return sum;
      
      const totalLoanAmount = this.calculateTotalLoanAmount(
        monthlyEMI,
        interest,
        totalTenure
      );
      const paidAmount = paidMonths * monthlyEMI;
      const remaining = totalLoanAmount - paidAmount;
      
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);
  });

  monthlyLoanEMI = computed(() => {
    const loans = this.loans();
    if (!loans || loans.length === 0) return 0;
    
    return loans.reduce((sum, loan) => {
      const monthlyEMI = (loan as any).monthly_emi || (loan as any).monthlyEMI || 0;
      return sum + monthlyEMI;
    }, 0);
  });

  // Computed values for Credit Cards
  totalCreditLimit = computed(() => {
    const cards = this.creditCards();
    const uniqueCards = this.getUniqueCards(cards);
    return uniqueCards.reduce((sum, card) => sum + (card.card_limit || 0), 0);
  });

  totalCreditUsed = computed(() => {
    const cards = this.creditCards();
    const uniqueCards = this.getUniqueCards(cards);
    return uniqueCards.reduce((sum, card) => sum + (card.utilized_amount || 0), 0);
  });

  totalCreditDue = computed(() => {
    const cards = this.creditCards();
    const uniqueCards = this.getUniqueCards(cards);
    return uniqueCards.reduce((sum, card) => sum + (card.due_amount || 0), 0);
  });

  // Computed values for Subscriptions
  monthlySubscriptions = computed(() => {
    return this.subscriptionsService.calculateMonthlyTotal(
      this.subscriptions().filter((sub) => sub.is_active !== false)
    );
  });

  activeSubscriptionsCount = computed(() => {
    return this.subscriptions().filter((sub) => sub.is_active !== false).length;
  });

  // Computed values for Investments
  goldInvestmentValue = computed(() => {
    return this.goldInvestments().reduce(
      (sum, inv) => sum + (inv.monthly_amount || 0),
      0
    );
  });

  mutualFundsValue = computed(() => {
    return this.mutualFunds().reduce(
      (sum, fund) => sum + (fund.total_current_value || 0),
      0
    );
  });

  postOfficeInvestmentValue = computed(() => {
    return this.postOfficeSchemes().reduce(
      (sum, scheme) => sum + (scheme.principal_amount || 0),
      0
    );
  });

  totalInvestments = computed(() => {
    return (
      this.goldInvestmentValue() +
      this.mutualFundsValue() +
      this.postOfficeInvestmentValue()
    );
  });

  // Net Worth Calculation
  netWorth = computed(() => {
    const investments = this.totalInvestments() || 0;
    const savings = this.monthlySavings() || 0;
    const debt = this.totalDebt() || 0;
    const creditDue = this.totalCreditDue() || 0;
    
    const assets = investments + savings;
    const liabilities = debt + creditDue;
    
    const result = assets - liabilities;
    return isNaN(result) ? 0 : result;
  });

  // Chart Data
  budgetChartData = computed(() => {
    const months = this.last5Months();
    
    return {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Income',
          data: months.map(m => m.income || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2,
          borderRadius: 6,
        },
        {
          label: 'Expenses',
          data: months.map(m => m.expenses || 0),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 2,
          borderRadius: 6,
        },
        {
          label: 'Savings',
          data: months.map(m => Math.abs(m.savings || 0)),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    };
  });

  investmentsChartData = computed(() => ({
    labels: ['Gold/Silver', 'Mutual Funds', 'Post Office'],
    datasets: [
      {
        data: [
          this.goldInvestmentValue(),
          this.mutualFundsValue(),
          this.postOfficeInvestmentValue(),
        ],
        backgroundColor: ['#fbbf24', '#8b5cf6', '#ec4899'],
        borderColor: ['#f59e0b', '#7c3aed', '#db2777'],
        borderWidth: 2,
      },
    ],
  }));

  debtChartData = computed(() => ({
    labels: ['Loans', 'Credit Card Due'],
    datasets: [
      {
        data: [this.totalDebt() || 0, this.totalCreditDue() || 0],
        backgroundColor: ['rgba(239, 68, 68, 0.8)', 'rgba(249, 115, 22, 0.8)'],
        borderColor: ['rgb(239, 68, 68)', 'rgb(249, 115, 22)'],
        borderWidth: 2,
      },
    ],
  }));

  budgetChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
            weight: '600',
          },
          padding: 15,
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            return `${label}: ₹${context.parsed.y.toLocaleString('en-IN')}`;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          font: {
            size: 12,
            weight: '500',
          },
          color: '#4b5563',
          callback: function(value: any) {
            return '₹' + Number(value).toLocaleString('en-IN');
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 13,
            weight: '600',
          },
          color: '#1f2937',
        },
      },
    },
  };

  constructor(private authService: AuthService, private router: Router) {
    this.authService.session$.subscribe((session) => {
      if (!session) this.router.navigate(['/login']);
    });
  }

  async ngOnInit() {
    try {
      const user = await this.supabaseService.getCurrentUser();
      if (user) {
        this.userId.set(user.id);
        await this.loadAllData(user.id);
      }
    } catch (err) {
      console.error('Failed to get user:', err);
      const demoUserId = this.getOrCreateDemoUserId();
      this.userId.set(demoUserId);
      await this.loadAllData(demoUserId);
    }
  }

  private getOrCreateDemoUserId(): string {
    const storageKey = 'demo-user-id';
    let userId = localStorage.getItem(storageKey);

    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem(storageKey, userId);
    }

    return userId;
  }

  async loadAllData(userId: string) {
    this.isLoading.set(true);

    try {
      // Get last 5 months as array for the store
      const monthYears = this.getLast5Months();
      
      // Use the store to load all data at once
      await this.appDataStore.loadAllData(userId, monthYears);
      
      // Load budget summary data
      await this.loadLast5MonthsBudgetData(userId);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private getLast5Months(): string[] {
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months: string[] = [];

    for (let i = 4; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = monthNames[date.getMonth()];
      const year = date.getFullYear();
      months.push(`${monthName} ${year}`);
    }

    return months;
  }

  async loadLast5MonthsBudgetData(userId: string) {
    try {
      const today = new Date();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const budgetMap = new Map<string, { income: number; expenses: number; savings: number }>();

      // Process budget entries from store
      const allEntries = this.budgetEntries();
      
      // Build the budget map from the entries
      allEntries.forEach((entry) => {
        const monthYear = entry.month_year;
        const key = monthYear.split(' ').join('');
        
        const existing = budgetMap.get(key) || { income: 0, expenses: 0, savings: 0 };
        
        if (entry.type === 'income') {
          existing.income += entry.amount || 0;
        } else if (entry.type === 'expense') {
          existing.expenses += entry.amount || 0;
        }
        
        existing.savings = existing.income - existing.expenses;
        budgetMap.set(key, existing);
      });

      this.monthlyBudgetData.set(budgetMap);
    } catch (error) {
      console.error('Error processing budget data:', error);
      this.monthlyBudgetData.set(new Map());
    }
  }

  calculateTotalLoanAmount(monthlyEMI: number, annualInterest: number, tenureMonths: number): number {
    if (!monthlyEMI || !annualInterest || !tenureMonths) return 0;
    
    const monthlyRate = annualInterest / 12 / 100;
    if (monthlyRate === 0) return monthlyEMI * tenureMonths;
    
    const principal =
      (monthlyEMI * (Math.pow(1 + monthlyRate, tenureMonths) - 1)) /
      (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));
    
    return principal;
  }

  getUniqueCards(cards: CreditCard[]): CreditCard[] {
    const uniqueMap = new Map<string, CreditCard>();
    
    cards.forEach((card) => {
      const key = `${card.card_name}-${card.last_four_digits}`;
      const existing = uniqueMap.get(key);
      if (!existing || new Date(card.created_at || '') > new Date(existing.created_at || '')) {
        uniqueMap.set(key, card);
      }
    });
    
    return Array.from(uniqueMap.values());
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  formatCurrency(value: number): string {
    const numValue = Number(value) || 0;
    if (isNaN(numValue)) return '₹0';
    
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(numValue);
  }

  formatCurrencyShort(value: number): string {
    const numValue = Number(value) || 0;
    if (isNaN(numValue)) return '₹0';
    
    if (numValue >= 10000000) {
      return '₹' + (numValue / 10000000).toFixed(2) + 'Cr';
    } else if (numValue >= 100000) {
      return '₹' + (numValue / 100000).toFixed(2) + 'L';
    } else if (numValue >= 1000) {
      return '₹' + (numValue / 1000).toFixed(2) + 'K';
    } else {
      return '₹' + numValue.toFixed(0);
    }
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-IN').format(value);
  }
}
