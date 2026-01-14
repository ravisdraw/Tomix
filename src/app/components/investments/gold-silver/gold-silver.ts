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
import { MonthStore } from '../../../store/month.store';
import { SupabaseService } from '../../../services/supabase.service';
import { GoldInvestmentsService, GoldInvestment } from '../../../services/gold-investments.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-gold-silver',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './gold-silver.html',
  styleUrl: './gold-silver.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoldSilver implements OnInit {
  showAddPlan = signal(false);
  investmentForm: any;
  editingPlanId = signal<string | null>(null);
  selectedPlanId = signal<string | null>(null);
  isCheckingData = signal(true);
  userId = signal<string | null>(null);
  investments = signal<GoldInvestment[]>([]);
  isAddingNew = signal(true);
  selectedExistingPlan = signal<GoldInvestment | null>(null);
  planAction = signal<'edit' | 'delete' | ''>('');
  showHistoryForPlan = signal<string | null>(null);
  planHistory = signal<GoldInvestment[]>([]);
  isLoadingHistory = signal(false);
  currentRates = signal<Map<string, number>>(new Map());
  planTotals = signal<Map<string, { totalAmount: number; totalGrams: number }>>(new Map());

  monthStore = inject(MonthStore);
  supabaseService = inject(SupabaseService);
  goldInvestmentsService = inject(GoldInvestmentsService);

  allPlans = computed(() => {
    const plans = this.investments();
    const uniqueMap = new Map<string, GoldInvestment>();
    
    plans.forEach((plan) => {
      if (plan.plan_id && !uniqueMap.has(plan.plan_id)) {
        uniqueMap.set(plan.plan_id, plan);
      }
    });
    
    return Array.from(uniqueMap.values());
  });

  goldPlans = computed(() => {
    return this.allPlans().filter(p => p.investment_type === 'gold');
  });

  silverPlans = computed(() => {
    return this.allPlans().filter(p => p.investment_type === 'silver');
  });

  totalGoldInvestment = computed(() => {
    return this.goldPlans().reduce((sum, plan) => sum + (plan.monthly_amount || 0), 0);
  });

  totalSilverInvestment = computed(() => {
    return this.silverPlans().reduce((sum, plan) => sum + (plan.monthly_amount || 0), 0);
  });

  totalGoldGrams = computed(() => {
    return this.goldPlans().reduce((sum, plan) => {
      const grams = plan.gold_rate && plan.gold_rate > 0 ? plan.monthly_amount / plan.gold_rate : 0;
      return sum + grams;
    }, 0);
  });

  totalSilverGrams = computed(() => {
    return this.silverPlans().reduce((sum, plan) => {
      const grams = plan.gold_rate && plan.gold_rate > 0 ? plan.monthly_amount / plan.gold_rate : 0;
      return sum + grams;
    }, 0);
  });

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.authService.session$.subscribe((session) => {
      if (!session) this.router.navigate(['/login']);
    });

    this.investmentForm = this.fb.group({
      plan_name: ['', Validators.required],
      monthly_amount: [0, [Validators.required, Validators.min(0)]],
      investment_type: ['gold', Validators.required],
      gold_rate: [0, [Validators.required, Validators.min(0)]],
      paid_date: [''],
      existing_plan_id: [''],
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

    this.fetchGoldRates();
    await this.loadInvestments();
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

  async fetchGoldRates() {
    // Rates are now managed per-plan through the currentRates signal
    // This method is kept for backward compatibility but does nothing
  }

  async loadInvestments() {
    this.isCheckingData.set(true);
    const userId = this.userId();

    if (!userId) return;

    try {
      const allInvestments = await this.goldInvestmentsService.getGoldInvestments(userId);
      this.investments.set(allInvestments);
      
      // Load totals for each unique plan
      const uniquePlans = this.allPlans();
      await this.loadPlanTotals(uniquePlans);
    } catch (error) {
      console.error('Error loading investments:', error);
    } finally {
      this.isCheckingData.set(false);
    }
  }

  async loadPlanTotals(plans: GoldInvestment[]) {
    const totalsMap = new Map<string, { totalAmount: number; totalGrams: number }>();
    
    for (const plan of plans) {
      if (!plan.plan_id) continue;
      
      try {
        const history = await this.goldInvestmentsService.getInvestmentHistory(
          this.userId()!,
          plan.plan_id
        );
        
        const totalAmount = history.reduce((sum, entry) => sum + entry.monthly_amount, 0);
        const totalGrams = history.reduce((sum, entry) => {
          const grams = entry.gold_rate && entry.gold_rate > 0 ? entry.monthly_amount / entry.gold_rate : 0;
          return sum + grams;
        }, 0);
        
        totalsMap.set(plan.plan_id, { totalAmount, totalGrams });
      } catch (error) {
        console.error('Error loading plan totals:', error);
      }
    }
    
    this.planTotals.set(totalsMap);
  }

  openAddPlan() {
    this.showAddPlan.set(true);
    this.resetForm();
  }

  closeAddPlan() {
    this.showAddPlan.set(false);
    this.resetForm();
  }

  resetForm() {
    this.investmentForm.reset({
      plan_name: '',
      monthly_amount: 0,
      investment_type: 'gold',
      paid_date: '',
      existing_plan_id: '',
    });
    this.editingPlanId.set(null);
    this.isAddingNew.set(true);
    this.selectedExistingPlan.set(null);
    this.planAction.set('');
  }

  onCardTypeChange() {
    this.investmentForm.patchValue({ existing_plan_id: '' });
    this.selectedExistingPlan.set(null);
    this.planAction.set('');
  }

  onExistingPlanSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const planId = select.value;
    
    if (!planId) {
      this.selectedExistingPlan.set(null);
      return;
    }

    const plan = this.allPlans().find((p) => p.plan_id === planId);
    if (plan) {
      this.selectedExistingPlan.set(plan);
      this.planAction.set('');
      
      this.investmentForm.patchValue({
        plan_name: plan.plan_name,
        monthly_amount: plan.monthly_amount,
        investment_type: plan.investment_type,
        gold_rate: plan.gold_rate || 0,
        paid_date: plan.paid_date,
      });
    }
  }

  onPlanActionChange(action: 'edit' | 'delete') {
    this.planAction.set(action);
    
    if (action === 'edit') {
      const plan = this.selectedExistingPlan();
      if (plan) {
        this.investmentForm.patchValue({
          plan_name: plan.plan_name,
          monthly_amount: plan.monthly_amount,
          investment_type: plan.investment_type,
          gold_rate: plan.gold_rate || 0,
          paid_date: plan.paid_date,
        });
      }
    }
  }

  async submitInvestment() {
    if (this.investmentForm.invalid && this.planAction() !== 'delete') {
      Object.keys(this.investmentForm.controls).forEach((key) => {
        this.investmentForm.get(key)?.markAsTouched();
      });
      return;
    }

    const userId = this.userId();
    if (!userId) return;

    try {
      const action = this.planAction();
      const existing = this.selectedExistingPlan();

      if (action === 'delete' && existing) {
        await this.goldInvestmentsService.deleteGoldInvestment(existing.id!);
        // alert('Plan deleted successfully!');
      } else if (this.editingPlanId()) {
        await this.goldInvestmentsService.updateGoldInvestment(this.editingPlanId()!, {
          plan_name: this.investmentForm.value.plan_name,
          monthly_amount: this.investmentForm.value.monthly_amount,
          investment_type: this.investmentForm.value.investment_type,
          gold_rate: this.investmentForm.value.gold_rate,
          paid_date: this.investmentForm.value.paid_date,
        });
        // alert('Investment updated successfully!');
      } else if (existing) {
        // Add new investment under existing plan
        const investment: GoldInvestment = {
          user_id: userId,
          plan_id: existing.plan_id,
          plan_name: existing.plan_name,
          monthly_amount: this.investmentForm.value.monthly_amount,
          investment_type: existing.investment_type,
          gold_rate: this.investmentForm.value.gold_rate,
          paid_date: this.investmentForm.value.paid_date,
        };
        await this.goldInvestmentsService.addGoldInvestment(investment);
        // alert('Investment added successfully!');
      } else {
        // Create new plan with a new plan_id
        const newPlanId = crypto.randomUUID();
        const investment: GoldInvestment = {
          user_id: userId,
          plan_id: newPlanId,
          plan_name: this.investmentForm.value.plan_name,
          monthly_amount: this.investmentForm.value.monthly_amount,
          investment_type: this.investmentForm.value.investment_type,
          gold_rate: this.investmentForm.value.gold_rate,
          paid_date: this.investmentForm.value.paid_date,
        };
        await this.goldInvestmentsService.addGoldInvestment(investment);
        alert('Investment plan created successfully!');
      }

      await this.loadInvestments();
      this.closeAddPlan();
    } catch (error) {
      console.error('Error submitting investment:', error);
      alert('Failed to save investment. Please try again.');
    }
  }



  updateCurrentRate(planId: string, rate: number) {
    const rates = new Map(this.currentRates());
    rates.set(planId, rate);
    this.currentRates.set(rates);
  }

  getCurrentRate(planId: string): number {
    return this.currentRates().get(planId) || 0;
  }

  getCurrentValue(planId: string, totalGrams: number): number {
    const rate = this.getCurrentRate(planId);
    const totals = this.planTotals().get(planId);
    const grams = totals ? totals.totalGrams : totalGrams;
    return rate > 0 ? parseFloat((grams * rate).toFixed(2)) : 0;
  }

  getPlanTotalAmount(planId: string): number {
    const totals = this.planTotals().get(planId);
    return totals ? totals.totalAmount : 0;
  }

  getPlanTotalGramsFromMap(planId: string): number {
    const totals = this.planTotals().get(planId);
    return totals ? totals.totalGrams : 0;
  }

  formatPaidDate(paidDate: string | undefined): string {
    if (!paidDate) return 'N/A';
    const date = new Date(paidDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  async showPlanHistory(plan: GoldInvestment) {
    this.showHistoryForPlan.set(plan.plan_id!);
    this.isLoadingHistory.set(true);

    try {
      const history = await this.goldInvestmentsService.getInvestmentHistory(
        this.userId()!,
        plan.plan_id!
      );
      this.planHistory.set(history);
    } catch (error) {
      console.error('Error loading plan history:', error);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  editPlan(plan: GoldInvestment) {
    this.editingPlanId.set(plan.id!);
    this.investmentForm.patchValue({
      plan_name: plan.plan_name,
      monthly_amount: plan.monthly_amount,
      investment_type: plan.investment_type,
      gold_rate: plan.gold_rate || 0,
      paid_date: plan.paid_date,
    });
    this.showAddPlan.set(true);
  }

  async deletePlan(planId: string) {
    // if (!confirm('Are you sure you want to delete this investment?')) return;

    try {
      await this.goldInvestmentsService.deleteGoldInvestment(planId);
      await this.loadInvestments();
      // alert('Investment deleted successfully!');
    } catch (error) {
      console.error('Error deleting investment:', error);
      alert('Failed to delete investment. Please try again.');
    }
  }

  async deleteHistoryEntry(entryId: string) {
    if (!confirm('Are you sure you want to delete this investment entry?')) return;

    try {
      await this.goldInvestmentsService.deleteGoldInvestment(entryId);
      
      // Refresh the history for the current plan
      const currentPlanId = this.showHistoryForPlan();
      const userId = this.userId();
      
      if (currentPlanId && userId) {
        const history = await this.goldInvestmentsService.getInvestmentHistory(userId, currentPlanId);
        this.planHistory.set(history);
      }
      
      // Reload all investments to update totals
      await this.loadInvestments();
    } catch (error) {
      console.error('Error deleting investment entry:', error);
      alert('Failed to delete investment entry. Please try again.');
    }
  }

  formatIndianRupee(amount: number): string {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  onAmountChange(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/,/g, '');
    
    if (value === '' || isNaN(Number(value))) {
      this.investmentForm.patchValue({ [controlName]: 0 });
      input.value = '0';
      return;
    }

    const numValue = parseFloat(value);
    this.investmentForm.patchValue({ [controlName]: numValue });
    input.value = this.formatIndianRupee(numValue);
  }

  calculateTotalValue(plan: GoldInvestment): number {
    const grams = plan.gold_rate && plan.gold_rate > 0 ? plan.monthly_amount / plan.gold_rate : 0;
    return grams * (plan.gold_rate || 0);
  }

  getPlanGrams(plan: GoldInvestment): number {
    return plan.gold_rate && plan.gold_rate > 0 ? plan.monthly_amount / plan.gold_rate : 0;
  }

  getPlanGradient(type: 'gold' | 'silver'): string {
    if (type === 'gold') {
      return 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)';
    } else {
      return 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
    }
  }
}
