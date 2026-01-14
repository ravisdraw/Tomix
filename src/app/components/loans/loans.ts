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
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LoansStore } from '../../store/loans.store';
import { SupabaseService } from '../../services/supabase.service';
import { LoansService } from '../../services/loans/loans.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EmojiPicker } from '../../shared/emoji-picker/emoji-picker';

interface Loan {
  id: string | number;
  loanName: string;
  emoji: string;
  monthlyEMI: number;  // Changed from amount to monthlyEMI
  interest: number;
  totalTenure: number;  // Total tenure in months
  paidMonths: number;   // Months already paid
  monthlyDueDate: number;
  // Calculated fields
  totalLoanAmount?: number;
  remainingAmount?: number;
  remainingMonths?: number;
  totalInterest?: number;
}

interface EMIScheduleRow {
  monthNumber: number;
  monthYear: string;
  openingBalance: number;
  emi: number;
  interest: number;
  principal: number;
  extraPayment: number;
  totalPrincipal: number;
  closingBalance: number;
  isPaid: boolean;
}

@Component({
  selector: 'app-loans',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CommonModule,
    EmojiPicker,
  ],
  templateUrl: './loans.html',
  styleUrl: './loans.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [LoansStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Loans implements OnInit {
  showAddLoan = signal(false);
  selectedLoanId = signal<string | number | null>(null);
  editingLoanId = signal<string | number | null>(null);
  isCheckingData = signal(true);
  loanForm: any;
  userId = signal<string | null>(null);
  
  // EMI Schedule signals
  showSchedule = signal(false);
  selectedLoanForSchedule = signal<Loan | null>(null);
  emiSchedule = signal<EMIScheduleRow[]>([]);

  loansStore = inject(LoansStore);
  supabaseService = inject(SupabaseService);
  loansService = inject(LoansService);

  // Computed property for loan items
  loanItems = computed(() => {
    return this.loansStore.loans() as Loan[];
  });

  totalLoanAmount = computed(() => {
    return this.loanItems().reduce(
      (sum: number, item: Loan) => sum + (this.calculateTotalLoanAmount(item.monthlyEMI, item.interest, item.totalTenure) || 0),
      0
    );
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.authService.session$.subscribe((session) => {
      if (!session) this.router.navigate(['/login']);
    });

    this.loanForm = this.fb.group({
      loanName: ['', Validators.required],
      emoji: ['💰'],
      monthlyEMI: [0, [Validators.required, Validators.min(1)]],
      interest: [0, [Validators.required, Validators.min(0)]],
      totalTenure: [0, [Validators.required, Validators.min(1)]],
      paidMonths: [0, [Validators.required, Validators.min(0)]],
      monthlyDueDate: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
    });
  }

  async ngOnInit() {
    try {
      const user = await this.supabaseService.getCurrentUser();
      if (user) {
        this.userId.set(user.id);
        this.loadLoans(user.id);
      }
    } catch (err) {
      console.error('Failed to get user:', err);
      // For demo purposes, use a default UUID
      const demoUserId = this.getOrCreateDemoUserId();
      this.userId.set(demoUserId);
      this.loadLoans(demoUserId);
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

  private async loadLoans(userId: string) {
    this.isCheckingData.set(true);
    try {
      await this.loansStore.loadLoansByUser(userId);
    } catch (error) {
      console.error('Error loading loans:', error);
    } finally {
      this.isCheckingData.set(false);
    }
  }

  openAddLoan() {
    this.editingLoanId.set(null);
    this.selectedLoanId.set(null);
    this.loanForm.reset({
      loanName: '',
      emoji: '💰',
      monthlyEMI: 0,
      interest: 0,
      totalTenure: 0,
      paidMonths: 0,
      monthlyDueDate: 1,
    });
    this.showAddLoan.set(true);
  }

  toggleLoanSelection(loanId: string | number) {
    if (this.selectedLoanId() === loanId) {
      this.selectedLoanId.set(null);
    } else {
      this.selectedLoanId.set(loanId);
    }
  }

  editLoan(loan: Loan) {
    this.editingLoanId.set(loan.id);
    this.loanForm.patchValue({
      loanName: loan.loanName,
      emoji: loan.emoji,
      monthlyEMI: loan.monthlyEMI,
      interest: loan.interest,
      totalTenure: loan.totalTenure,
      paidMonths: loan.paidMonths,
      monthlyDueDate: loan.monthlyDueDate,
    });
    this.showAddLoan.set(true);
  }

  async saveLoan() {
    if (this.loanForm.invalid) {
      return;
    }

    const userId = this.userId();
    if (!userId) {
      console.error('User ID not set');
      return;
    }

    try {
      const formValue = this.loanForm.value;
      const editingId = this.editingLoanId();

      if (editingId) {
        // Update existing loan
        await this.loansStore.updateLoan(editingId as string, formValue);
      } else {
        // Save new loan
        await this.loansStore.saveLoan(formValue, userId);
      }

      this.closeLoanForm();
      await this.loadLoans(userId);
    } catch (error) {
      console.error('Error saving loan:', error);
    }
  }

  async deleteLoan(loanId: string | number) {
    if (confirm('Are you sure you want to delete this loan?')) {
      try {
        await this.loansStore.deleteLoan(loanId as string);
        const userId = this.userId();
        if (userId) {
          await this.loadLoans(userId);
        }
        this.selectedLoanId.set(null);
      } catch (error) {
        console.error('Error deleting loan:', error);
      }
    }
  }

  closeLoanForm() {
    this.showAddLoan.set(false);
    this.editingLoanId.set(null);
    this.selectedLoanId.set(null);
    this.loanForm.reset();
  }

  // EMI Schedule Methods
  toggleEMISchedule(loan: Loan) {
    if (this.showSchedule() && this.selectedLoanForSchedule()?.id === loan.id) {
      // If clicking the same loan's info icon, close it
      this.closeEMISchedule();
    } else {
      // Otherwise, show the schedule for this loan
      this.selectedLoanForSchedule.set(loan);
      this.generateEMISchedule(loan);
      this.showSchedule.set(true);
    }
  }

  closeEMISchedule() {
    this.showSchedule.set(false);
    this.selectedLoanForSchedule.set(null);
    this.emiSchedule.set([]);
  }

  generateEMISchedule(loan: Loan) {
    const schedule: EMIScheduleRow[] = [];
    const monthlyRate = loan.interest / 12 / 100;
    const totalLoanAmount = this.calculateTotalLoanAmount(loan.monthlyEMI, loan.interest, loan.totalTenure);
    let balance = this.calculateRemainingAmount(loan.monthlyEMI, loan.interest, loan.totalTenure - loan.paidMonths);
    
    const currentDate = new Date();
    const startMonth = loan.paidMonths;
    const remainingMonths = loan.totalTenure - loan.paidMonths;

    for (let i = 0; i < remainingMonths; i++) {
      const monthDate = new Date(currentDate);
      monthDate.setMonth(currentDate.getMonth() + i);
      
      // Calculate interest for this month
      const interest = Math.round(balance * monthlyRate);
      
      // Calculate principal portion from EMI (EMI - Interest)
      const principal = Math.round(loan.monthlyEMI - interest);
      
      // Extra payment defaults to 0 but can be edited by user
      const extraPayment = 0;
      
      // Total principal = regular principal + any extra payment
      const totalPrincipal = principal + extraPayment;
      
      // Closing balance = opening balance minus total principal paid
      // Note: Interest doesn't reduce the balance, only principal payments do
      const closingBalance = Math.max(0, Math.round(balance - totalPrincipal));

      schedule.push({
        monthNumber: startMonth + i + 1,
        monthYear: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        openingBalance: Math.round(balance),
        emi: loan.monthlyEMI,
        interest: interest,
        principal: principal,
        extraPayment: extraPayment,
        totalPrincipal: totalPrincipal,
        closingBalance: closingBalance,
        isPaid: false
      });

      balance = closingBalance;
      
      // Stop if balance becomes 0
      if (balance <= 0) break;
    }

    this.emiSchedule.set(schedule);
  }

  recalculateSchedule(fromIndex: number) {
    const schedule = [...this.emiSchedule()];
    const loan = this.selectedLoanForSchedule();
    if (!loan) return;

    const monthlyRate = loan.interest / 12 / 100;

    // Recalculate from the changed row onwards
    for (let i = fromIndex; i < schedule.length; i++) {
      const row = schedule[i];
      
      if (i === fromIndex) {
        // For the changed row, recalculate total principal and closing balance
        row.totalPrincipal = row.principal + (row.extraPayment || 0);
        row.closingBalance = Math.max(0, Math.round(row.openingBalance - row.totalPrincipal));
      } else {
        // For subsequent rows, update opening balance and recalculate everything
        row.openingBalance = schedule[i - 1].closingBalance;
        
        if (row.openingBalance <= 0) {
          // Loan is fully paid, zero out remaining rows
          row.interest = 0;
          row.principal = 0;
          row.emi = 0;
          row.extraPayment = 0;
          row.totalPrincipal = 0;
          row.closingBalance = 0;
        } else {
          row.interest = Math.round(row.openingBalance * monthlyRate);
          row.principal = Math.round(loan.monthlyEMI - row.interest);
          row.totalPrincipal = row.principal + (row.extraPayment || 0);
          row.closingBalance = Math.max(0, Math.round(row.openingBalance - row.totalPrincipal));
        }
      }
    }

    this.emiSchedule.set(schedule);
  }

  // Totals for EMI Schedule
  getTotalEMI(): number {
    return this.emiSchedule().reduce((sum, row) => sum + row.emi, 0);
  }

  getTotalInterestPaid(): number {
    return this.emiSchedule().reduce((sum, row) => sum + row.interest, 0);
  }

  getTotalPrincipalPaid(): number {
    return this.emiSchedule().reduce((sum, row) => sum + row.principal, 0);
  }

  getTotalExtraPayment(): number {
    return this.emiSchedule().reduce((sum, row) => sum + (row.extraPayment || 0), 0);
  }

  getTotalPrincipalWithExtra(): number {
    return this.emiSchedule().reduce((sum, row) => sum + row.totalPrincipal, 0);
  }

  // Format number as Indian Rupee style (1,00,000)
  formatIndianRupee(amount: number): string {
    if (!amount) return '0';
    return amount.toLocaleString('en-IN');
  }

  // Calculate total loan amount (Principal) from EMI, interest rate, and tenure
  calculateTotalLoanAmount(emi: number, annualRate: number, tenureMonths: number): number {
    if (!emi || !tenureMonths || emi <= 0 || tenureMonths <= 0) {
      return 0;
    }
    
    // If interest rate is 0, principal = EMI * tenure
    if (annualRate === 0) {
      return emi * tenureMonths;
    }
    
    // Monthly interest rate
    const monthlyRate = annualRate / 12 / 100;
    
    // Reverse EMI Formula: P = EMI × [(1+R)^N-1] / [R × (1+R)^N]
    const principal = (emi * (Math.pow(1 + monthlyRate, tenureMonths) - 1)) / 
                     (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));
    
    return Math.round(principal);
  }

  // Calculate remaining amount
  calculateRemainingAmount(emi: number, annualRate: number, remainingMonths: number): number {
    return this.calculateTotalLoanAmount(emi, annualRate, remainingMonths);
  }

  // Calculate total interest paid
  calculateTotalInterest(emi: number, tenureMonths: number, principal: number): number {
    const totalPaid = emi * tenureMonths;
    return Math.round(totalPaid - principal);
  }

  // Calculate monthly EMI (kept for backward compatibility)
  calculateMonthlyEMI(principal: number, annualRate: number, tenureMonths: number): number {
    if (!principal || !tenureMonths || principal <= 0 || tenureMonths <= 0) {
      return 0;
    }
    
    // If interest rate is 0, EMI is simply principal divided by tenure
    if (annualRate === 0) {
      return principal / tenureMonths;
    }
    
    // Monthly interest rate
    const monthlyRate = annualRate / 12 / 100;
    
    // EMI Formula: [P x R x (1+R)^N] / [(1+R)^N-1]
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / 
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    
    return Math.round(emi);
  }

  getTotalInterest(): string {
    const total = this.loanItems().reduce(
      (sum: number, item: Loan) => sum + (item.interest || 0),
      0
    );
    return total.toFixed(2);
  }

  getTotalTenure(): number {
    return this.loanItems().reduce(
      (sum: number, item: Loan) => sum + (item.totalTenure || 0),
      0
    );
  }
}
