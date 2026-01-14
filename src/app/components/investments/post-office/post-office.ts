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
import { SupabaseService } from '../../../services/supabase.service';
import { PostOfficeSchemesService, PostOfficeScheme } from '../../../services/post-office-schemes.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

interface MaturityDetail {
  month: number;
  principalRemaining: number;
  interestAccrued: number;
  totalAmount: number;
}

@Component({
  selector: 'app-post-office',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './post-office.html',
  styleUrl: './post-office.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostOffice implements OnInit {
  showAddScheme = signal(false);
  schemeForm: any;
  editingSchemeId = signal<string | null>(null);
  selectedSchemeId = signal<string | null>(null);
  isCheckingData = signal(true);
  userId = signal<string | null>(null);
  schemes = signal<PostOfficeScheme[]>([]);
  isAddingNew = signal(true);
  selectedExistingScheme = signal<PostOfficeScheme | null>(null);
  schemeAction = signal<'edit' | 'delete' | ''>('');
  showHistoryForScheme = signal<string | null>(null);
  schemeHistory = signal<PostOfficeScheme[]>([]);
  isLoadingHistory = signal(false);
  schemeTotals = signal<Map<string, { totalAmount: number; totalInterest: number; maturityValue: number; firstInvestedDate: Date; maturityDate: Date }>>(new Map());

  supabaseService = inject(SupabaseService);
  postOfficeSchemesService = inject(PostOfficeSchemesService);

  allSchemes = computed(() => {
    const schemesList = this.schemes();
    const uniqueMap = new Map<string, PostOfficeScheme>();
    
    schemesList.forEach((scheme) => {
      if (scheme.scheme_id && !uniqueMap.has(scheme.scheme_id)) {
        uniqueMap.set(scheme.scheme_id, scheme);
      }
    });
    
    return Array.from(uniqueMap.values());
  });

  totalInvestment = computed(() => {
    return this.allSchemes().reduce((sum, scheme) => {
      const totals = this.schemeTotals().get(scheme.scheme_id!);
      return sum + (totals ? totals.totalAmount : 0);
    }, 0);
  });

  totalMaturityValue = computed(() => {
    return this.allSchemes().reduce((sum, scheme) => {
      const totals = this.schemeTotals().get(scheme.scheme_id!);
      return sum + (totals ? totals.maturityValue : 0);
    }, 0);
  });

  totalInterest = computed(() => {
    return this.allSchemes().reduce((sum, scheme) => {
      const totals = this.schemeTotals().get(scheme.scheme_id!);
      return sum + (totals ? totals.totalInterest : 0);
    }, 0);
  });

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.authService.session$.subscribe((session) => {
      if (!session) this.router.navigate(['/login']);
    });

    this.schemeForm = this.fb.group({
      scheme_name: ['', Validators.required],
      interest_rate: [0, [Validators.required, Validators.min(0)]],
      principal_amount: [0, [Validators.required, Validators.min(0)]],
      maturity_years: [1, [Validators.required, Validators.min(0.5)]],
      paid_date: ['', Validators.required],
      existing_scheme_id: [''],
    });
  }

  async ngOnInit() {
    try {
      const user = await this.supabaseService.getCurrentUser();
      if (user) {
        this.userId.set(user.id);
      }
    } catch (err) {
      console.error('Failed to get user:', err);
      const demoUserId = this.getOrCreateDemoUserId();
      this.userId.set(demoUserId);
    }

    await this.loadSchemes();
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

  async loadSchemes() {
    this.isCheckingData.set(true);
    const userId = this.userId();

    if (!userId) return;

    try {
      const allSchemes = await this.postOfficeSchemesService.getPostOfficeSchemes(userId);
      this.schemes.set(allSchemes);
      
      // Load totals for each unique scheme
      const uniqueSchemes = this.allSchemes();
      await this.loadSchemeTotals(uniqueSchemes);
    } catch (error) {
      console.error('Error loading schemes:', error);
    } finally {
      this.isCheckingData.set(false);
    }
  }

  async loadSchemeTotals(schemes: PostOfficeScheme[]) {
    const totalsMap = new Map<string, { totalAmount: number; totalInterest: number; maturityValue: number; firstInvestedDate: Date; maturityDate: Date }>();
    
    for (const scheme of schemes) {
      if (!scheme.scheme_id) continue;
      
      try {
        const history = await this.postOfficeSchemesService.getSchemeHistory(
          this.userId()!,
          scheme.scheme_id
        );
        
        const totalAmount = history.reduce((sum, entry) => sum + entry.principal_amount, 0);
        let totalMaturity = 0;
        
        // Find the earliest paid date (first investment date)
        const firstInvestedDate = history.reduce((earliest, entry) => {
          const entryDate = new Date(entry.paid_date);
          return entryDate < earliest ? entryDate : earliest;
        }, new Date(history[0].paid_date));
        
        // Calculate maturity date from first investment + maturity period
        const maturityDate = new Date(firstInvestedDate);
        maturityDate.setMonth(maturityDate.getMonth() + history[0].maturity_months);
        
        const now = new Date();
        
        // Calculate current maturity value based on actual time elapsed for each entry
        history.forEach((entry) => {
          const paidDate = new Date(entry.paid_date);
          const yearsElapsed = (now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          
          // Use compound interest based on actual years elapsed (compounded annually)
          const maturity = entry.principal_amount * Math.pow((1 + entry.interest_rate / 100), yearsElapsed);
          totalMaturity += maturity;
        });
        
        const totalInterest = totalMaturity - totalAmount;
        
        totalsMap.set(scheme.scheme_id, { 
          totalAmount, 
          totalInterest, 
          maturityValue: Math.round(totalMaturity * 100) / 100,
          firstInvestedDate,
          maturityDate
        });
      } catch (error) {
        console.error('Error loading scheme totals:', error);
      }
    }
    
    this.schemeTotals.set(totalsMap);
  }

  openAddScheme() {
    this.showAddScheme.set(true);
    this.resetForm();
  }

  closeAddScheme() {
    this.showAddScheme.set(false);
    this.resetForm();
  }

  resetForm() {
    this.schemeForm.reset({
      scheme_name: '',
      interest_rate: 0,
      principal_amount: 0,
      maturity_years: 1,
      paid_date: '',
      existing_scheme_id: '',
    });
    this.editingSchemeId.set(null);
    this.isAddingNew.set(true);
    this.selectedExistingScheme.set(null);
    this.schemeAction.set('');
  }

  onSchemeTypeChange() {
    this.schemeForm.patchValue({ existing_scheme_id: '' });
    this.selectedExistingScheme.set(null);
    this.schemeAction.set('');
  }

  onExistingSchemeSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const schemeId = select.value;
    
    if (!schemeId) {
      this.selectedExistingScheme.set(null);
      return;
    }

    const scheme = this.allSchemes().find((s) => s.scheme_id === schemeId);
    if (scheme) {
      this.selectedExistingScheme.set(scheme);
      this.schemeAction.set('');
      
      this.schemeForm.patchValue({
        scheme_name: scheme.scheme_name,
        interest_rate: scheme.interest_rate,
        principal_amount: scheme.principal_amount,
        maturity_years: scheme.maturity_months / 12,
        paid_date: scheme.paid_date,
      });
    }
  }

  onSchemeActionChange(action: 'edit' | 'delete') {
    this.schemeAction.set(action);
    
    if (action === 'edit') {
      const scheme = this.selectedExistingScheme();
      if (scheme) {
        this.schemeForm.patchValue({
          scheme_name: scheme.scheme_name,
          interest_rate: scheme.interest_rate,
          principal_amount: scheme.principal_amount,
          maturity_years: scheme.maturity_months / 12,
          paid_date: scheme.paid_date,
        });
      }
    }
  }

  async submitScheme() {
    if (this.schemeForm.invalid && this.schemeAction() !== 'delete') {
      Object.keys(this.schemeForm.controls).forEach((key) => {
        this.schemeForm.get(key)?.markAsTouched();
      });
      return;
    }

    const userId = this.userId();
    if (!userId) return;

    try {
      const action = this.schemeAction();
      const existing = this.selectedExistingScheme();

      const maturityMonths = Math.round(this.schemeForm.value.maturity_years * 12);
      const paidDate = new Date(this.schemeForm.value.paid_date);
      const maturityDate = new Date(paidDate);
      maturityDate.setMonth(maturityDate.getMonth() + maturityMonths);

      if (action === 'delete' && existing) {
        await this.postOfficeSchemesService.deletePostOfficeScheme(existing.id!);
        alert('Scheme deleted successfully!');
      } else if (this.editingSchemeId()) {
        await this.postOfficeSchemesService.updatePostOfficeScheme(this.editingSchemeId()!, {
          scheme_name: this.schemeForm.value.scheme_name,
          interest_rate: this.schemeForm.value.interest_rate,
          principal_amount: this.schemeForm.value.principal_amount,
          maturity_months: maturityMonths,
          paid_date: this.schemeForm.value.paid_date,
          maturity_date: maturityDate.toISOString().split('T')[0],
        });
        alert('Scheme updated successfully!');
      } else if (existing) {
        // Add new entry under existing scheme
        const newEntry: PostOfficeScheme = {
          user_id: userId,
          scheme_id: existing.scheme_id,
          scheme_name: existing.scheme_name,
          interest_rate: existing.interest_rate,
          principal_amount: this.schemeForm.value.principal_amount,
          maturity_months: existing.maturity_months,
          paid_date: this.schemeForm.value.paid_date,
          maturity_date: maturityDate.toISOString().split('T')[0],
        };
        await this.postOfficeSchemesService.addPostOfficeScheme(newEntry);
        alert('Scheme entry added successfully!');
      } else {
        // Create new scheme with a new scheme_id
        const newSchemeId = crypto.randomUUID();
        const scheme: PostOfficeScheme = {
          user_id: userId,
          scheme_id: newSchemeId,
          scheme_name: this.schemeForm.value.scheme_name,
          interest_rate: this.schemeForm.value.interest_rate,
          principal_amount: this.schemeForm.value.principal_amount,
          maturity_months: maturityMonths,
          paid_date: this.schemeForm.value.paid_date,
          maturity_date: maturityDate.toISOString().split('T')[0],
        };
        await this.postOfficeSchemesService.addPostOfficeScheme(scheme);
        alert('Scheme created successfully!');
      }

      await this.loadSchemes();
      this.closeAddScheme();
    } catch (error) {
      console.error('Error submitting scheme:', error);
      alert('Failed to save scheme. Please try again.');
    }
  }

  async showSchemeHistory(scheme: PostOfficeScheme) {
    this.showHistoryForScheme.set(scheme.scheme_id!);
    this.isLoadingHistory.set(true);

    try {
      const history = await this.postOfficeSchemesService.getSchemeHistory(
        this.userId()!,
        scheme.scheme_id!
      );
      this.schemeHistory.set(history);
    } catch (error) {
      console.error('Error loading scheme history:', error);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  editScheme(scheme: PostOfficeScheme) {
    this.editingSchemeId.set(scheme.id!);
    this.schemeForm.patchValue({
      scheme_name: scheme.scheme_name,
      interest_rate: scheme.interest_rate,
      principal_amount: scheme.principal_amount,
      maturity_years: scheme.maturity_months / 12,
      paid_date: scheme.paid_date,
    });
    this.showAddScheme.set(true);
  }

  async deleteScheme(schemeId: string) {
    if (!confirm('Are you sure you want to delete this scheme?')) return;

    try {
      await this.postOfficeSchemesService.deletePostOfficeScheme(schemeId);
      await this.loadSchemes();
      alert('Scheme deleted successfully!');
    } catch (error) {
      console.error('Error deleting scheme:', error);
      alert('Failed to delete scheme. Please try again.');
    }
  }

  async deleteHistoryEntry(entryId: string) {
    if (!confirm('Are you sure you want to delete this scheme entry?')) return;

    try {
      await this.postOfficeSchemesService.deletePostOfficeScheme(entryId);
      
      // Refresh the history for the current scheme
      const currentSchemeId = this.showHistoryForScheme();
      const userId = this.userId();
      
      if (currentSchemeId && userId) {
        const history = await this.postOfficeSchemesService.getSchemeHistory(userId, currentSchemeId);
        this.schemeHistory.set(history);
      }
      
      // Reload all schemes to update totals
      await this.loadSchemes();
    } catch (error) {
      console.error('Error deleting scheme entry:', error);
      alert('Failed to delete scheme entry. Please try again.');
    }
  }

  formatIndianRupee(amount: number): string {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  onAmountChange(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/,/g, '');
    
    if (value === '' || isNaN(Number(value))) {
      this.schemeForm.patchValue({ [controlName]: 0 });
      input.value = '0';
      return;
    }

    const numValue = parseFloat(value);
    this.schemeForm.patchValue({ [controlName]: numValue });
    input.value = this.formatIndianRupee(numValue);
  }

  calculateMaturity(scheme: PostOfficeScheme): number {
    // Calculate current value based on actual years elapsed from paid date
    const paidDate = new Date(scheme.paid_date);
    const now = new Date();
    const yearsElapsed = (now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    // Compound interest is calculated annually based on actual time elapsed
    const maturityAmount = scheme.principal_amount * Math.pow((1 + scheme.interest_rate / 100), yearsElapsed);
    return Math.round(maturityAmount * 100) / 100;
  }

  calculateInterest(scheme: PostOfficeScheme): number {
    return this.calculateMaturity(scheme) - scheme.principal_amount;
  }

  getMonthsPaid(scheme: PostOfficeScheme): number {
    if (!scheme.paid_date) return 0;
    const paidDate = new Date(scheme.paid_date);
    const now = new Date();
    const diffTime = now.getTime() - paidDate.getTime();
    const diffMonths = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    return Math.max(0, Math.min(diffMonths, scheme.maturity_months));
  }

  getSchemeMonthsPaid(schemeId: string): number {
    const history = this.schemes().filter(s => s.scheme_id === schemeId);
    if (history.length === 0) return 0;
    
    // Get the earliest paid date
    const earliestPaidDate = history.reduce((earliest, entry) => {
      const entryDate = new Date(entry.paid_date);
      return entryDate < earliest ? entryDate : earliest;
    }, new Date(history[0].paid_date));
    
    const now = new Date();
    const diffTime = now.getTime() - earliestPaidDate.getTime();
    
    // Calculate months including partial months, rounding up
    const monthsPaid = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
    
    // Get the maturity months from the first entry
    const totalMonths = history[0].maturity_months;
    
    // Ensure at least 1 month is shown if there's an investment and paid date is not in the future
    return Math.max(diffTime >= 0 ? 1 : 0, Math.min(monthsPaid, totalMonths));
  }

  getTotalMonths(schemeId: string): number {
    const scheme = this.allSchemes().find(s => s.scheme_id === schemeId);
    return scheme ? scheme.maturity_months : 0;
  }

  getSchemeGradient(): string {
    return 'linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #fdc830 100%)';
  }

  getPlanGradient(): string {
    return '#ffffff';
  }

  getRemainingMonths(scheme: PostOfficeScheme): number {
    if (!scheme.maturity_date) return 0;
    
    const now = new Date();
    const maturity = new Date(scheme.maturity_date);
    const diffTime = maturity.getTime() - now.getTime();
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    
    return Math.max(0, diffMonths);
  }

  formatPaidDate(paidDate: string | undefined): string {
    if (!paidDate) return 'N/A';
    const date = new Date(paidDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  getSchemeTotalAmount(schemeId: string): number {
    const totals = this.schemeTotals().get(schemeId);
    return totals ? totals.totalAmount : 0;
  }

  getSchemeTotalInterest(schemeId: string): number {
    const totals = this.schemeTotals().get(schemeId);
    return totals ? totals.totalInterest : 0;
  }

  getSchemeMaturityValue(schemeId: string): number {
    const totals = this.schemeTotals().get(schemeId);
    return totals ? totals.maturityValue : 0;
  }

  getSchemeMaturityDate(schemeId: string): string {
    const totals = this.schemeTotals().get(schemeId);
    if (!totals) return 'N/A';
    
    const date = totals.maturityDate;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  getSchemeFirstInvestedDate(schemeId: string): string {
    const totals = this.schemeTotals().get(schemeId);
    if (!totals) return 'N/A';
    
    const date = totals.firstInvestedDate;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }
}
