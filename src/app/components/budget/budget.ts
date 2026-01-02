import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { MonthYearPicker } from '../../shared/month-year-picker/month-year-picker';
import { EmojiPicker } from '../../shared/emoji-picker/emoji-picker';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BudgetStore } from '../../store/budget.store';
import { MonthStore } from '../../store/month.store';
import { SupabaseService } from '../../services/supabase.service';
import { BudgetEntriesService } from '../../services/budget-entries.service';
import { ExpenseCategoriesService } from '../../services/expense-categories.service';
import { BankAccountsService } from '../../services/bank-accounts.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BarChartComponent } from '../../charts/bar-chart/bar-chart';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { DoughnutChartComponent } from '../../charts/doughnut-chart/doughnut-chart';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface BudgetEntry {
  id: string | number;
  expenseName: string;
  emoji: string;
  amount: number;
  type: string;
  category: string;
  bankAccount: string;
  carryForward?: boolean;
  mark_as_paid?: boolean;
}

interface MonthBudget {
  income: BudgetEntry[];
  expenses: BudgetEntry[];
}

@Component({
  selector: 'app-budget',
  imports: [
    MonthYearPicker,
    EmojiPicker,
    ReactiveFormsModule,
    CommonModule,
    BarChartComponent,
    DoughnutChartComponent,
  ],
  templateUrl: './budget.html',
  styleUrl: './budget.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [BudgetStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Budget implements OnInit {
  showAddExpense = signal(false);
  showAddBankAccount = signal(false);
  selectedMonth = signal('');
  expenseForm: any;
  bankAccountForm: any;
  selectedCategory = signal('');
  editingItemId = signal<string | number | null>(null);
  editingBankAccountId = signal<string | null>(null);
  selectedItemId = signal<string | number | null>(null);
  selectedBankAccountId = signal<string | null>(null);
  hasDataForMonth = signal(false);
  isCheckingData = signal(true);
  isLoadingBankAccounts = signal(true);
  chartLabels = signal<string[]>([]);
  chartExpenseData = signal<number[]>([]);
  chartIncomeData = signal<number[]>([]);
  chartSavingsData = signal<number[]>([]);
  expenseCategories = signal<any[]>([]);
  bankAccounts = signal<any[]>([]);
  doughnutLabels = signal<string[]>([]);
  doughnutData = signal<number[]>([]);
  doughnutColors = signal<string[]>([]);
  showCarryForwardModal = signal(false);
  carryForwardItems = signal<BudgetEntry[]>([]);
  previousMonth = signal<string>('');
  previousMonthKey = signal<string>('');
  selectedExpenses = signal<Map<string | number, number>>(new Map());
  totalSelectedExpense = signal<number>(0);
  paidExpenses = signal<Map<string | number, boolean>>(new Map());

  // Computed property for bar chart data
  chartData = computed(() => ({
    labels: this.chartLabels(),
    datasets: [
      {
        label: 'Income',
        data: this.chartIncomeData(),
        backgroundColor: '#08B783',
        borderColor: '#08B783',
        borderWidth: 1,
      },
      {
        label: 'Expenses',
        data: this.chartExpenseData(),
        backgroundColor: '#FC3134',
        borderColor: '#FC3134',
        borderWidth: 1,
      },
      {
        label: 'Savings',
        data: this.chartSavingsData(),
        backgroundColor: '#fcba03',
        borderColor: '#fcba03',
        borderWidth: 1,
      },
    ],
  }));

  // Computed property for doughnut chart data
  doughnutChartData = computed(() => ({
    labels: this.doughnutLabels(),
    datasets: [
      {
        data: this.doughnutData(),
        backgroundColor: this.doughnutColors(),
        borderColor: '#fff',
        borderWidth: 2,
      },
    ],
  }));

  budgetStore = inject(BudgetStore);
  monthStore = inject(MonthStore);
  supabaseService = inject(SupabaseService);
  budgetEntriesService = inject(BudgetEntriesService);
  expenseCategoriesService = inject(ExpenseCategoriesService);
  bankAccountsService = inject(BankAccountsService);
  userId = signal<string | null>(null);

  // Category options
  categories = [
    'Income',
    'Travel',
    'Recharge',
    'Subscriptions',
    'Food',
    'EMI',
    'Family',
    'Investments',
    'Gold',
  ];

  // Computed properties for current month's income and expenses
  currentMonthKey = computed(() => {
    const monthStr = this.monthStore.month();
    return monthStr.split(' ').join('');
  });

  incomeItems = computed(() => {
    const budget = this.budgetStore.budget() as Record<string, MonthBudget>;
    const monthKey = this.currentMonthKey();
    return (budget[monthKey]?.income || []) as BudgetEntry[];
  });

  expenseItems = computed(() => {
    const budget = this.budgetStore.budget() as Record<string, MonthBudget>;
    const monthKey = this.currentMonthKey();
    return (budget[monthKey]?.expenses || []) as BudgetEntry[];
  });

  totalIncome = computed(() => {
    let income = this.incomeItems().reduce(
      (sum: number, item: BudgetEntry) => sum + (item.amount || 0),
      0
    );
    let totalBalance = income - this.totalExpense();
    return totalBalance;
  });

  totalExpense = computed(() => {
    return this.expenseItems().reduce(
      (sum: number, item: BudgetEntry) => sum + (item.amount || 0),
      0
    );
  });

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.authService.session$.subscribe((session) => {
      if (!session) this.router.navigate(['/login']);
    });
    this.expenseForm = this.fb.group({
      expenseName: ['', Validators.required],
      emoji: [''],
      amount: [0, [Validators.required, Validators.min(1)]],
      type: ['expense', Validators.required],
      category: ['', Validators.required],
      bankAccount: ['HDFC', Validators.required],
      carryForward: [false],
    });

    this.bankAccountForm = this.fb.group({
      bank_name: ['', Validators.required],
      balance: [0, [Validators.required, Validators.min(0)]],
    });

    // Set up effect to watch for month changes and reload data
    effect(() => {
      const currentMonth = this.monthStore.month();
      const prev = this.previousMonth();
      const userId = this.userId();

      // Do nothing until we have a user
      if (!userId) return;

      // Initial load: previousMonth not yet set
      if (!prev) {
        this.previousMonth.set(currentMonth);
        // this.loadCurrentMonthData();
        this.loadChartData();
        return;
      }

      // Month changed: check carry forward items and reload
      if (currentMonth !== prev) {
        this.checkForCarryForwardItems();
        this.previousMonth.set(currentMonth);
        // this.loadCurrentMonthData();
        this.loadChartData();
      }
    });

    // Set up effect to recalculate doughnut chart whenever expenses change
    // effect(() => {
    //   this.expenseItems();
    //   this.aggregateExpensesByCategory();
    // });
  }

  async ngOnInit() {
    try {
      const user = await this.supabaseService.getCurrentUser();
      if (user) {
        this.userId.set(user.id);
        this.loadExpenseCategories(user.id);
        this.loadBankAccounts(user.id);
        // Effect will automatically load data when userId is set
      }
    } catch (err) {
      console.error('Failed to get user:', err);
      // For demo purposes, use a default UUID
      const demoUserId = this.getOrCreateDemoUserId();
      this.userId.set(demoUserId);
      this.loadExpenseCategories(demoUserId);
      this.loadBankAccounts(demoUserId);
      // Effect will automatically load data when userId is set
    }
  }

  private getOrCreateDemoUserId(): string {
    const storageKey = 'demo-user-id';
    let userId = localStorage.getItem(storageKey);

    if (!userId) {
      // Generate a valid UUID v4 format for demo
      userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      localStorage.setItem(storageKey, userId);
    }

    return userId;
  }

  // async loadCurrentMonthData() {
  //   const monthYear = this.monthStore.month();
  //   const userId = this.userId();
  //   if (userId) {
  //     this.isCheckingData.set(true);
  //     try {
  //       await this.budgetStore.loadBudgetByMonth(monthYear, userId);

  //       const incomeCount = this.incomeItems().length;
  //       const expenseCount = this.expenseItems().length;
  //       const hasData = incomeCount > 0 || expenseCount > 0;

  //       this.hasDataForMonth.set(hasData);
  //       console.log(
  //         `Data loaded for ${monthYear}: ${hasData ? 'Found' : 'No data found'
  //         } (Income: ${incomeCount}, Expenses: ${expenseCount})`
  //       );

  //       this.setMarkAsPaidMap();

  //       await this.loadChartData();

  //       await this.aggregateExpensesByCategory();
  //     } catch (error) {
  //       console.error('Error loading month data:', error);
  //       this.hasDataForMonth.set(false);
  //     } finally {
  //       this.isCheckingData.set(false);
  //     }
  //   }
  // }

  private async setMarkAsPaidMap() {
    this.expenseItems().forEach((item) => {
      this.paidExpenses().set(item.id, item.mark_as_paid || false);
    });
    console.log(this.paidExpenses());
  }

  private async loadChartData() {
    const userId = this.userId();
    if (!userId) return;
    try {
      const last5Months = this.getLast5Months();
      const labels: string[] = [];
      const expenseData: number[] = [];
      const incomeData: number[] = [];
      const savingsData: number[] = [];

      try {
        let entries: any[] = [];
        entries = await this.budgetEntriesService.getBudgetEntriesByDateRange(last5Months, userId);

        this.setCurrentMonth(entries)

        await this.aggregateExpensesByCategory();

        for (const monthYear of last5Months) {
          labels.push(monthYear);
          const totalExpense = entries
            .filter((entry) => entry.type === 'expense' && entry.month_year === monthYear)
            .reduce((sum, entry) => sum + entry.amount, 0);
          const totalIncome = entries
            .filter((entry) => entry.type === 'income' && entry.month_year === monthYear)
            .reduce((sum, entry) => sum + entry.amount, 0);
          const totalSavings = entries
            .filter((entry) => entry.type === 'expense' && entry.month_year === monthYear)
            .filter((expense) => expense.category === 'Investment')
            .reduce((sum, cat) => sum + cat.amount, 0);
          expenseData.push(totalExpense - totalSavings);
          incomeData.push(totalIncome);
          savingsData.push(totalSavings);
        }
        this.chartLabels.set(labels);
        this.chartExpenseData.set(expenseData);
        this.chartIncomeData.set(incomeData);
        this.chartSavingsData.set(savingsData);
      } catch (error) {
        expenseData.push(0);
        incomeData.push(0);
        savingsData.push(0);
      } finally {
        this.isCheckingData.set(false);
      }
    }
    catch (error) {
      console.error('Error loading chart data:', error);
    }
    finally {
      this.isCheckingData.set(false);
    }
  }

  setCurrentMonth(entries: any[]) {
    const monthYear = this.monthStore.month();

    entries = entries.filter(e => e.month_year === monthYear);
    // Transform database entries to camelCase format
    const transformedEntries = entries.map((e: any) => ({
      id: e.id,
      expenseName: e.expense_name,
      emoji: e.emoji,
      amount: e.amount,
      type: e.type,
      category: e.category,
      bankAccount: e.bank_account,
      carryForward: e.carry_forward || false,
      mark_as_paid: e.mark_as_paid || false,
    }));

    // Transform flat array into organized budget object
    const budget: Record<string, any> = {};
    budget[monthYear.split(' ').join('')] = {
      income: transformedEntries.filter(e => e.type === 'income'),
      expenses: transformedEntries.filter(e => e.type === 'expense')
    };

    this.budgetStore.setBudget(budget);

    this.setMarkAsPaidMap();
  }

  private async aggregateExpensesByCategory() {
    try {
      // Use current month expenses from the store
      const expenses = this.expenseItems();

      if (expenses.length === 0) {
        this.doughnutLabels.set([]);
        this.doughnutData.set([]);
        this.doughnutColors.set([]);
        return;
      }

      // Group by category and sum amounts
      const categoryMap = new Map<string, number>();
      const categoryColorMap = new Map<string, string>();

      const colors = [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40',
        '#FF6B6B',
        '#C9CBCF',
        '#4BC0C0',
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
      ];

      let colorIndex = 0;

      for (const expense of expenses) {
        const category = expense.category || 'Other';
        categoryMap.set(category, (categoryMap.get(category) || 0) + expense.amount);

        if (!categoryColorMap.has(category)) {
          categoryColorMap.set(category, colors[colorIndex % colors.length]);
          colorIndex++;
        }
      }

      // Convert to arrays for chart
      const labels = Array.from(categoryMap.keys());
      const data = Array.from(categoryMap.values());
      const chartColors = labels.map((cat) => categoryColorMap.get(cat) || '#999');

      this.doughnutLabels.set(labels);
      this.doughnutData.set(data);
      this.doughnutColors.set(chartColors);

      console.log(this.doughnutChartData());
    } catch (error) {
      console.error('Error aggregating expenses by category:', error);
      this.doughnutLabels.set([]);
      this.doughnutData.set([]);
      this.doughnutColors.set([]);
    }
  }

  private getLast5Months(): string[] {
    const months: string[] = [];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const today = new Date();

    for (let i = 4; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      months.push(`${month} ${year}`);
    }

    return months;
  }

  private async loadExpenseCategories(userId: string) {
    try {
      const categories = (await this.expenseCategoriesService.getExpenseCategories(userId)) || [];
      this.expenseCategories.set(categories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async selectCategory(category: any) {
    this.selectedCategory.set(category.category_name);
    this.expenseForm.patchValue({
      category: category.category_name,
      emoji: category.emoji,
    });
    this.selectedCategory.set(category.category_name);
  }

  openAddExpense() {
    this.resetForm();
    this.showAddExpense.set(true);
  }

  toggleItemSelection(itemId: string | number) {
    if (this.selectedItemId() === itemId) {
      this.selectedItemId.set(null);
    } else {
      this.selectedItemId.set(itemId);
    }
  }

  closeAddExpense() {
    this.showAddExpense.set(false);
    this.selectedItemId.set(null);
    if (!this.editingItemId()) {
      this.resetForm();
    }
  }

  onEmojiSelected(emoji: string) {
    console.log('Emoji selected:', emoji);
    this.expenseForm.patchValue({ emoji });
    console.log('Form value after emoji:', this.expenseForm.value);
  }

  onAmountChange(event: any) {
    const inputValue = event.target.value;

    // Remove all non-digit characters
    let numericValue = inputValue.replace(/[^\d]/g, '');

    if (numericValue === '') {
      event.target.value = '';
      this.expenseForm.get('amount')?.setValue('', { emitEvent: false });
      return;
    }

    const num = parseInt(numericValue, 10);
    if (!isNaN(num)) {
      // Format with Indian numbering system and show it in real-time
      const formatted = num.toLocaleString('en-IN');
      event.target.value = formatted;
      // Update form control with numeric value
      this.expenseForm.get('amount')?.setValue(formatted, { emitEvent: false });
    }
  }

  async submitExpense() {
    if (this.expenseForm.invalid) {
      return;
    }

    const form = this.expenseForm.value;
    const amountValue =
      typeof form.amount === 'string'
        ? parseInt(String(form.amount).replace(/,/g, ''), 10) || 0
        : form.amount;

    const monthYear = this.monthStore.month();
    const userId = this.userId();

    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    const editingId = this.editingItemId();

    try {
      // moved updateAfterExpensePaidStatus to after saving and reloading data so totals include the new/updated expense
      if (editingId) {
        // Update existing item in Supabase
        await this.budgetStore.updateBudgetEntry(String(editingId), {
          expense_name:
            form.expenseName.charAt(0).toUpperCase() + form.expenseName.slice(1).toLowerCase(),
          emoji: form.emoji || '💳',
          amount: amountValue,
          type: form.type,
          category: form.category,
          bank_account: form.bankAccount,
          carry_forward: form.carryForward || false,
        });
      } else {
        // Create new item in Supabase
        await this.budgetStore.saveBudgetEntry(
          {
            expenseName:
              form.expenseName.charAt(0).toUpperCase() + form.expenseName.slice(1).toLowerCase(),
            emoji: form.emoji || '💳',
            amount: amountValue,
            type: form.type,
            category: form.category,
            bankAccount: form.bankAccount,
            monthYear: monthYear,
            carryForward: form.carryForward || false,
          },
          userId
        );
      }

      this.updateExpenseCategory(form.category);
      // Reload data from Supabase to sync with database
      await this.loadChartData();
      // Recalculate and persist bank after-expense-paid using updated totals
      await this.updateAfterExpensePaidStatus(form.bankAccount);
      this.resetForm();
      this.closeAddExpense();
    } catch (error) {
      console.error('Error saving budget entry:', error);
      alert('Failed to save budget entry. Please try again.');
    }
  }

  async updateAfterExpensePaidStatus(bank: string) {
    const account = this.bankAccounts().find(acc => acc.bank_name.toLowerCase() === bank.toLowerCase());
    let afterExpensePaid = 0;
    if (account) {
      // const totalExpenses = this.totalExpense();
      const totalUnpaidExpenses = this.expenseItems().filter(item => item.bankAccount.toLowerCase() === bank.toLowerCase() && !item.mark_as_paid).reduce((sum, item) => sum + item.amount, 0);
      afterExpensePaid = account.balance - totalUnpaidExpenses;
      account.after_expense_paid = afterExpensePaid;
      this.bankAccounts.set([...this.bankAccounts()]);
      try {
        await this.bankAccountsService.updateBankAccount(account.id, {
          after_expense_paid: afterExpensePaid,
        });
        // reload bank accounts to ensure UI stays in sync with DB
        const userId = this.userId();
        if (userId) {
          await this.loadBankAccounts(userId);
        }
      } catch (error) {
        console.error('Error updating after expense paid status:', error);
      }
    }
  }

  async updateExpenseCategory(category: string) {
    let isNewCategory: string = '';
    console.log(this.expenseCategories());

    isNewCategory = this.expenseCategories().find((item: any) => {
      return item.category_name === category;
    });

    if (!isNewCategory) {
      try {
        // Save new category to Supabase
        const userId = this.userId();
        if (userId) {
          await this.expenseCategoriesService.createExpenseCategory({
            user_id: userId,
            category_name: category,
            emoji: '📁', // Default emoji for new categories
          });

          // Reload expense categories after adding new one
          await this.loadExpenseCategories(userId);
          console.log('New category added successfully:', category);
        }
      } catch (error) {
        console.error('Error saving category: ', error);
        alert('Failed saving new category');
      }
    }
  }

  setBudget() {
    let budget = this.budgetStore.budget() as Record<string, MonthBudget>;
    let monthKey = this.currentMonthKey();
    let form = this.expenseForm.value;

    if (!budget[monthKey]) {
      budget[monthKey] = {
        income: [],
        expenses: [],
      };
    }

    const amountValue =
      typeof form.amount === 'number'
        ? form.amount
        : parseFloat(String(form.amount).replace(/,/g, '')) || 0;
    const entry: BudgetEntry = {
      id: Date.now(),
      expenseName:
        (form.expenseName || '').charAt(0).toUpperCase() +
        (form.expenseName || '').slice(1).toLowerCase(),
      emoji: form.emoji || '💳',
      amount: amountValue,
      type: form.type || 'expense',
      category: form.category || '',
      bankAccount: form.bankAccount || '',
    };

    if (form?.type === 'expense') {
      budget[monthKey].expenses.push(entry);
    } else if (form?.type === 'income') {
      budget[monthKey].income.push(entry);
    }

    const updatedBudget = JSON.parse(JSON.stringify(budget));
    this.budgetStore.setBudget(updatedBudget);
  }

  // Format number as Indian Rupee style (1,00,000)
  formatIndianRupee(amount: number): string {
    if (!amount) return '0';
    return amount.toLocaleString('en-IN');
  }

  async deleteItem(itemId: string | number) {
    try {
      await this.budgetStore.deleteBudgetEntry(String(itemId));
      // Reload data from Supabase
      await this.loadChartData();
    } catch (error) {
      console.error('Error deleting budget entry:', error);
      alert('Failed to delete budget entry. Please try again.');
    }
  }

  async deleteCategory(categoryId: string) {
    try {
      await this.expenseCategoriesService.deleteExpenseCategory(categoryId);
      // Reload expense categories after deleting
      const userId = this.userId();
      if (userId) {
        await this.loadExpenseCategories(userId);
      }
      console.log('Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category. Please try again.');
    }
  }

  editItem(item: BudgetEntry) {
    this.editingItemId.set(item.id);
    this.selectedCategory.set(item.category);
    this.expenseForm.patchValue({
      expenseName: item.expenseName,
      emoji: item.emoji,
      amount: item.amount.toLocaleString('en-IN'),
      type: item.type,
      category: item.category,
      bankAccount: item.bankAccount,
      carryForward: item.carryForward || false,
    });
    this.showAddExpense.set(true);
  }

  resetForm() {
    this.editingItemId.set(null);
    this.selectedCategory.set('');
    this.expenseForm.reset({
      expenseName: '',
      emoji: '',
      amount: 0,
      type: 'expense',
      category: '',
      bankAccount: 'HDFC',
      carryForward: false,
    });
  }

  // Bank Account Methods
  async loadBankAccounts(userId: string) {
    try {
      this.isLoadingBankAccounts.set(true);
      const accounts = await this.bankAccountsService.getBankAccounts(userId);
      this.bankAccounts.set(accounts);
      console.log('Bank accounts loaded:', accounts);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    } finally {
      this.isLoadingBankAccounts.set(false);
    }
  }

  openAddBankAccount() {
    this.resetBankAccountForm();
    this.showAddBankAccount.set(true);
  }

  closeBankAccountForm() {
    this.showAddBankAccount.set(false);
    this.selectedBankAccountId.set(null);
    if (!this.editingBankAccountId()) {
      this.resetBankAccountForm();
    }
  }

  onBankAccountAmountChange(event: any) {
    const inputValue = event.target.value;
    // Remove all non-digit characters
    let numericValue = inputValue.replace(/[^\d]/g, '');

    if (numericValue === '') {
      event.target.value = '';
      this.bankAccountForm.get('balance')?.setValue('', { emitEvent: false });
      return;
    }

    const num = parseInt(numericValue, 10);
    if (!isNaN(num)) {
      const formatted = num.toLocaleString('en-IN');
      event.target.value = formatted;
      this.bankAccountForm.get('balance')?.setValue(formatted, { emitEvent: false });
    }
  }

  async setBankBalance(accountId: string, newBalance: number) {
    try {
      await this.bankAccountsService.updateBankAccount(accountId, { balance: newBalance });
      const userId = this.userId();
      if (userId) {
        await this.loadBankAccounts(userId);
      } 
    } catch (error) {
      console.error('Error updating bank balance:', error);
      alert('Failed to update bank balance. Please try again.');
    } 
  }

  async submitBankAccount() {
    if (this.bankAccountForm.invalid) {
      return;
    }

    const form = this.bankAccountForm.value;
    const balanceValue =
      typeof form.balance === 'string'
        ? parseInt(String(form.balance).replace(/,/g, ''), 10) || 0
        : form.balance;

    const userId = this.userId();

    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    const editingId = this.editingBankAccountId();

    try {
      if (editingId) {
        // Update existing bank account
        await this.bankAccountsService.updateBankAccount(editingId, {
          bank_name: form.bank_name.charAt(0).toUpperCase() + form.bank_name.slice(1).toLowerCase(),
          balance: balanceValue,
        });
        console.log('Bank account updated successfully');
      } else {
        // Create new bank account
        await this.bankAccountsService.createBankAccount({
          user_id: userId,
          bank_name: form.bank_name.charAt(0).toUpperCase() + form.bank_name.slice(1).toLowerCase(),
          balance: balanceValue,
          after_expense_paid: balanceValue,
        });
        console.log('Bank account created successfully');
      }

      // Reload bank accounts
      await this.loadBankAccounts(userId);
      this.resetBankAccountForm();
      this.closeBankAccountForm();
    } catch (error) {
      console.error('Error saving bank account:', error);
      alert('Failed to save bank account. Please try again.');
    }
  }

  editBankAccount(account: any) {
    this.editingBankAccountId.set(account.id);
    this.bankAccountForm.patchValue({
      bank_name: account.bank_name,
      balance: account.balance.toLocaleString('en-IN'),
    });
    this.showAddBankAccount.set(true);
  }

  async deleteBankAccount(accountId: string) {
    if (confirm('Are you sure you want to delete this bank account?')) {
      try {
        await this.bankAccountsService.deleteBankAccount(accountId);
        const userId = this.userId();
        if (userId) {
          await this.loadBankAccounts(userId);
        }
        console.log('Bank account deleted successfully');
      } catch (error) {
        console.error('Error deleting bank account:', error);
        alert('Failed to delete bank account. Please try again.');
      }
    }
  }

  toggleBankAccountSelection(accountId: string) {
    if (this.selectedBankAccountId() === accountId) {
      this.selectedBankAccountId.set(null);
    } else {
      this.selectedBankAccountId.set(accountId);
    }
  }

  resetBankAccountForm() {
    this.editingBankAccountId.set(null);
    this.bankAccountForm.reset({
      bank_name: '',
      balance: 0,
    });
  }

  // Carry Forward Methods
  private async checkForCarryForwardItems() {
    try {
      const userId = this.userId();
      if (!userId || !this.previousMonth()) {
        console.log('No userId or previousMonth set');
        return;
      }

      // Fetch the previous month's data directly from Supabase
      const previousMonthString = this.previousMonth();
      console.log('Checking carry forward for month:', previousMonthString);

      const previousMonthEntries = await this.budgetEntriesService.getBudgetEntriesByMonth(
        previousMonthString,
        userId
      );

      console.log('Previous month entries:', previousMonthEntries);

      // Find expenses marked as carry forward
      const carryForwardExpenses = previousMonthEntries
        .filter((entry: any) => {
          // Handle different boolean representations
          const isCarryForward = entry.carry_forward === true ||
            entry.carry_forward === 'true' ||
            entry.carry_forward === 'TRUE' ||
            entry.carry_forward === 1;
          return isCarryForward && (entry.type === 'expense' || entry.type === 'income');
        })
        .map((entry: any) => ({
          id: entry.id,
          expenseName: entry.expense_name,
          emoji: entry.emoji,
          amount: entry.amount,
          type: entry.type,
          category: entry.category,
          bankAccount: entry.bank_account,
          carryForward: entry.carry_forward,
        }));

      console.log('Found carry forward expenses:', carryForwardExpenses);

      if (carryForwardExpenses.length > 0) {
        this.carryForwardItems.set(carryForwardExpenses);
        this.previousMonthKey.set(previousMonthString);
        this.showCarryForwardModal.set(true);
        console.log('Modal should now be visible');
      }
    } catch (error) {
      console.error('Error checking carry forward items:', error);
    }
  }

  private getPreviousMonthKey(): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [monthStr, yearStr] = this.previousMonth().split(' ');
    const monthIndex = monthNames.indexOf(monthStr);

    let prevMonthIndex = monthIndex - 1;
    let prevYear = parseInt(yearStr);

    if (prevMonthIndex < 0) {
      prevMonthIndex = 11;
      prevYear--;
    }

    const prevMonth = monthNames[prevMonthIndex];
    return `${prevMonth}${prevYear}`;
  }

  async includeCarryForwardItems() {
    try {
      const userId = this.userId();
      if (!userId) return;

      const currentMonth = this.monthStore.month();
      const carryForwardExpenses = this.carryForwardItems();

      for (const expense of carryForwardExpenses) {
        // Create new entry in current month with carry forward flag
        await this.budgetStore.saveBudgetEntry(
          {
            expenseName: expense.expenseName,
            emoji: expense.emoji,
            amount: expense.amount,
            type: expense.type,
            category: expense.category,
            bankAccount: expense.bankAccount,
            monthYear: currentMonth,
            carryForward: true,
          },
          userId
        );
      }

      // Reload current month data to show new items
      await this.loadChartData();
      this.closeCarryForwardModal();
    } catch (error) {
      console.error('Error including carry forward items:', error);
      alert('Failed to include carry forward items. Please try again.');
    }
  }

  closeCarryForwardModal() {
    this.showCarryForwardModal.set(false);
    this.carryForwardItems.set([]);
    this.previousMonthKey.set('');
  }

  getSelectedItems(event: any, itemId: string | number, amount: number) {
    const isChecked = event.target.checked;
    if (isChecked) {
      this.selectedExpenses().set(itemId, amount);
    } else {
      this.selectedExpenses().delete(itemId);
    }
    // Recalculate total selected expense
    let total = 0;
    this.selectedExpenses().forEach((amount) => {
      total += amount;
    });
    this.totalSelectedExpense.set(total);
  }

  async markAsPaid(itemId: string | number, amount: number, bank: string) {
    let status:boolean = false;
    if (this.paidExpenses().get(itemId) === true) {
      this.paidExpenses().set(itemId, false);
      status = false;
    } else {
      this.paidExpenses().set(itemId, true);
      status = true;
    }
    console.log(this.paidExpenses());
    try {
      await this.budgetStore.markBudgetEntryAsPaid(String(itemId), this.paidExpenses().get(itemId) || false);
      await this.updateBankBalance(amount,bank,status);
    } catch (error) {
      console.error('Error marking budget entry as paid:', error);
      alert('Failed to update payment status. Please try again.');
    }
    this.selectedItemId.set(null);
  }

  async updateBankBalance(amount: number, bank: string, status: boolean) {
    const account = this.bankAccounts().find(acc => acc.bank_name.toLowerCase() === bank.toLowerCase());
    let amountToUpdate = amount;
    if (status) {
      amountToUpdate = account.balance - amount;
    } else {
      amountToUpdate = account.balance + amount;
    }
    try {
        await this.bankAccountsService.updateBankAccount(account.id, {
          balance: amountToUpdate,
        });
        // reload bank accounts to ensure UI stays in sync with DB
        const userId = this.userId();
        if (userId) {
          await this.loadBankAccounts(userId);
        }
      } catch (error) {
        console.error('Error updating after expense paid status:', error);
      }
  }
}