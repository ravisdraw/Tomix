import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';
import { SubscriptionsService, Subscription } from '../../services/subscriptions.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EmojiPicker } from '../../shared/emoji-picker/emoji-picker';
import { AppDataStore } from '../../store/app-data.store';

@Component({
  selector: 'app-subscriptions',
  imports: [ReactiveFormsModule, CommonModule, EmojiPicker],
  templateUrl: './subscriptions.html',
  styleUrl: './subscriptions.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Subscriptions implements OnInit {
  showAddSubscription = signal(false);
  subscriptionForm: any;
  selectedSubscriptionId = signal<string | null>(null);
  editingSubscriptionId = signal<string | null>(null);
  subscriptions = signal<Subscription[]>([]);
  isLoading = signal(true);
  userId = signal<string | null>(null);

  supabaseService = inject(SupabaseService);
  subscriptionsService = inject(SubscriptionsService);
  appDataStore = inject(AppDataStore);

  // Billing cycle options
  billingCycles = ['monthly', 'quarterly', 'yearly'];

  // Popular subscription emojis
  popularEmojis = ['💳', '📱', '📺', '🎮', '🎵', '☁️', '🌐', '📡'];

  // Computed properties
  activeSubscriptions = computed(() => {
    return this.subscriptions().filter((sub) => sub.is_active !== false);
  });

  totalMonthlyAmount = computed(() => {
    return this.subscriptionsService.calculateMonthlyTotal(this.activeSubscriptions());
  });

  upcomingSubscriptions = computed(() => {
    return this.subscriptionsService.getUpcomingSubscriptions(this.activeSubscriptions());
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.authService.session$.subscribe((session) => {
      if (!session) this.router.navigate(['/login']);
    });

    this.subscriptionForm = this.fb.group({
      name: ['', Validators.required],
      emoji: ['💳'],
      plan_details: [''],
      billing_amount: [0, [Validators.required, Validators.min(1)]],
      billing_date: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
      billing_cycle: ['monthly', Validators.required],
      start_date: [this.getTodayDate(), Validators.required],
      end_date: [''],
      is_active: [true],
      is_mobile_recharge: [false],
      notes: [''],
    });

    // Subscribe to mobile recharge checkbox changes to update validators
    this.subscriptionForm.get('is_mobile_recharge')?.valueChanges.subscribe((isMobileRecharge: boolean) => {
      const billingDateControl = this.subscriptionForm.get('billing_date');
      const billingCycleControl = this.subscriptionForm.get('billing_cycle');
      const startDateControl = this.subscriptionForm.get('start_date');

      if (isMobileRecharge) {
        // For mobile recharge, remove validators
        billingDateControl?.clearValidators();
        billingCycleControl?.clearValidators();
        startDateControl?.clearValidators();
      } else {
        // For regular subscriptions, add validators back
        billingDateControl?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
        billingCycleControl?.setValidators([Validators.required]);
        startDateControl?.setValidators([Validators.required]);
      }

      billingDateControl?.updateValueAndValidity();
      billingCycleControl?.updateValueAndValidity();
      startDateControl?.updateValueAndValidity();
    });
  }

  async ngOnInit() {
    try {
      const user = await this.supabaseService.getCurrentUser();
      if (user) {
        this.userId.set(user.id);
        await this.loadSubscriptions(user.id);
      }
    } catch (err) {
      console.error('Failed to get user:', err);
      // For demo purposes, use a default UUID
      const demoUserId = this.getOrCreateDemoUserId();
      this.userId.set(demoUserId);
      await this.loadSubscriptions(demoUserId);
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

  private async loadSubscriptions(userId: string) {
    this.isLoading.set(true);
    try {
      // Check if data already loaded in store for this user
      if (this.appDataStore.subscriptionsLoaded() && this.appDataStore.currentUserId() === userId) {
        // Use existing data from store
        const subs = this.appDataStore.subscriptions();
        this.subscriptions.set(subs);
        console.log('Using cached subscriptions data');
      } else {
        // Load from store (which will fetch from API if needed)
        await this.appDataStore.loadSubscriptions(userId);
        const subs = this.appDataStore.subscriptions();
        this.subscriptions.set(subs);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  openAddSubscription() {
    this.resetForm();
    this.showAddSubscription.set(true);
  }

  closeAddSubscription() {
    this.showAddSubscription.set(false);
    this.selectedSubscriptionId.set(null);
    if (!this.editingSubscriptionId()) {
      this.resetForm();
    }
  }

  toggleSubscriptionSelection(id: string) {
    if (this.selectedSubscriptionId() === id) {
      this.selectedSubscriptionId.set(null);
    } else {
      this.selectedSubscriptionId.set(id);
    }
  }

  onEmojiSelected(emoji: string) {
    this.subscriptionForm.patchValue({ emoji });
  }

  onAmountChange(event: any) {
    const inputValue = event.target.value;
    let numericValue = inputValue.replace(/[^\d]/g, '');

    if (numericValue === '') {
      event.target.value = '';
      this.subscriptionForm.get('billing_amount')?.setValue('', { emitEvent: false });
      return;
    }

    const num = parseInt(numericValue, 10);
    if (!isNaN(num)) {
      const formatted = num.toLocaleString('en-IN');
      event.target.value = formatted;
      this.subscriptionForm.get('billing_amount')?.setValue(formatted, { emitEvent: false });
    }
  }

  async submitSubscription() {
    if (this.subscriptionForm.invalid) {
      return;
    }

    const form = this.subscriptionForm.value;
    const amountValue =
      typeof form.billing_amount === 'string'
        ? parseInt(String(form.billing_amount).replace(/,/g, ''), 10) || 0
        : form.billing_amount;

    const userId = this.userId();
    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    const editingId = this.editingSubscriptionId();

    try {
      const subscriptionData: any = {
        user_id: userId,
        name: form.name,
        emoji: form.emoji,
        plan_details: form.plan_details,
        billing_amount: amountValue,
        billing_date: parseInt(form.billing_date, 10),
        billing_cycle: form.billing_cycle,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        is_active: form.is_active,
        is_mobile_recharge: form.is_mobile_recharge || false,
        notes: form.notes,
      };

      if (editingId) {
        await this.subscriptionsService.updateSubscription(editingId, subscriptionData);
        this.editingSubscriptionId.set(null);
      } else {
        await this.subscriptionsService.createSubscription(subscriptionData);
      }

      if (userId) {
        await this.loadSubscriptions(userId);
      }
      this.closeAddSubscription();
      this.resetForm();
    } catch (error) {
      console.error('Error saving subscription:', error);
    }
  }

  editSubscription(subscription: Subscription) {
    this.editingSubscriptionId.set(subscription.id || null);
    this.subscriptionForm.patchValue({
      name: subscription.name,
      emoji: subscription.emoji,
      plan_details: subscription.plan_details,
      billing_amount: subscription.billing_amount,
      billing_date: subscription.billing_date,
      billing_cycle: subscription.billing_cycle,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      is_active: subscription.is_active,
      is_mobile_recharge: (subscription as any).is_mobile_recharge || false,
      notes: subscription.notes,
    });
    this.showAddSubscription.set(true);
    this.selectedSubscriptionId.set(null);
  }

  async deleteSubscription(id: string) {
    if (!confirm('Are you sure you want to delete this subscription?')) {
      return;
    }

    try {
      const userId = this.userId();
      await this.subscriptionsService.deleteSubscription(id);
      if (userId) {
        await this.loadSubscriptions(userId);
      }
      this.selectedSubscriptionId.set(null);
    } catch (error) {
      console.error('Error deleting subscription:', error);
    }
  }

  calculateDaysLeft(billingDate: number): number {
    return this.subscriptionsService.calculateDaysLeft(billingDate);
  }

  formatIndianRupee(amount: number): string {
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  getDaysLeftText(daysLeft: number): string {
    if (daysLeft === 0) return 'Today';
    if (daysLeft === 1) return 'Tomorrow';
    return `${daysLeft} days left`;
  }

  getBillingCycleText(cycle: string): string {
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  }

  private resetForm() {
    this.subscriptionForm.reset({
      name: '',
      emoji: '💳',
      plan_details: '',
      billing_amount: 0,
      billing_date: 1,
      billing_cycle: 'monthly',
      start_date: this.getTodayDate(),
      end_date: '',
      is_active: true,
      is_mobile_recharge: false,
      notes: '',
    });
    this.editingSubscriptionId.set(null);
  }

  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  getNextBillingDate(billingDate: number): string {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let nextBillingDate: Date;

    if (currentDay <= billingDate) {
      nextBillingDate = new Date(currentYear, currentMonth, billingDate);
    } else {
      nextBillingDate = new Date(currentYear, currentMonth + 1, billingDate);
    }

    return nextBillingDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  isExpiringSoon(endDate?: string): boolean {
    if (!endDate) return false;

    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 0 && diffDays <= 30; // Expiring within 30 days
  }

  calculateMobileRecharDaysLeft(endDate?: string): number {
    if (!endDate) return 0;

    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(diffDays, 0);
  }

  isMobileRecharge(subscription: Subscription): boolean {
    return (subscription as any).is_mobile_recharge || false;
  }

  isLastDay(endDate?: string): boolean {
    if (!endDate) return false;

    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays === 0; // Last day
  }
}
