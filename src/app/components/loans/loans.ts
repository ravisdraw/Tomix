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
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
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
  amount: number;
  interest: number;
  tenure: number;
  monthlyDueDate: number;
}

@Component({
  selector: 'app-loans',
  imports: [
    ReactiveFormsModule,
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

  loansStore = inject(LoansStore);
  supabaseService = inject(SupabaseService);
  loansService = inject(LoansService);

  // Computed property for loan items
  loanItems = computed(() => {
    return this.loansStore.loans() as Loan[];
  });

  totalLoanAmount = computed(() => {
    return this.loanItems().reduce(
      (sum: number, item: Loan) => sum + (item.amount || 0),
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
      amount: [0, [Validators.required, Validators.min(1)]],
      interest: [0, [Validators.required, Validators.min(0)]],
      tenure: [0, [Validators.required, Validators.min(1)]],
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
      amount: 0,
      interest: 0,
      tenure: 0,
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
      amount: loan.amount,
      interest: loan.interest,
      tenure: loan.tenure,
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

  // Format number as Indian Rupee style (1,00,000)
  formatIndianRupee(amount: number): string {
    if (!amount) return '0';
    return amount.toLocaleString('en-IN');
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
      (sum: number, item: Loan) => sum + (item.tenure || 0),
      0
    );
  }
}
