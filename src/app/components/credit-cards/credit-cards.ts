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
import { MonthStore } from '../../store/month.store';
import { SupabaseService } from '../../services/supabase.service';
import { CreditCardsService, CreditCard } from '../../services/credit-cards.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-credit-cards',
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './credit-cards.html',
  styleUrl: './credit-cards.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditCards implements OnInit {
  showAddCard = signal(false);
  creditCardForm: any;
  editingCardId = signal<string | null>(null);
  selectedCardId = signal<string | null>(null);
  isCheckingData = signal(true);
  userId = signal<string | null>(null);
  creditCards = signal<CreditCard[]>([]);
  flippedCards = signal<Set<string>>(new Set());
  previousMonth = signal<string>('');
  existingCards = signal<CreditCard[]>([]);
  isAddingNew = signal(true);
  selectedExistingCard = signal<CreditCard | null>(null);
  cardAction = signal<'edit' | 'delete' | ''>('');
  showHistoryForCard = signal<string | null>(null);
  cardHistory = signal<CreditCard[]>([]);
  isLoadingHistory = signal(false);

  monthStore = inject(MonthStore);
  supabaseService = inject(SupabaseService);
  creditCardsService = inject(CreditCardsService);

  // Computed property for current month key
  currentMonthKey = computed(() => {
    const monthStr = this.monthStore.month();
    return monthStr.split(' ').join('');
  });

  // Computed property for all unique cards (latest entry per card)
  currentMonthCards = computed(() => {
    const cards = this.creditCards();
    const uniqueMap = new Map<string, CreditCard>();
    
    // Get the most recent entry for each card
    cards.forEach((card) => {
      const key = `${card.card_name}-${card.last_four_digits}`;
      const existing = uniqueMap.get(key);
      if (!existing || new Date(card.created_at || '') > new Date(existing.created_at || '')) {
        uniqueMap.set(key, card);
      }
    });
    
    return Array.from(uniqueMap.values());
  });

  // Computed totals
  totalLimit = computed(() => {
    return this.currentMonthCards().reduce((sum, card) => sum + (card.card_limit || 0), 0);
  });

  totalUtilized = computed(() => {
    return this.currentMonthCards().reduce((sum, card) => sum + (card.utilized_amount || 0), 0);
  });

  totalDue = computed(() => {
    return this.currentMonthCards().reduce((sum, card) => sum + (card.due_amount || 0), 0);
  });

  availableCredit = computed(() => {
    return this.totalLimit() - this.totalUtilized();
  });

  utilizationPercentage = computed(() => {
    const limit = this.totalLimit();
    if (limit === 0) return 0;
    return Math.round((this.totalUtilized() / limit) * 100);
  });

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.authService.session$.subscribe((session) => {
      if (!session) this.router.navigate(['/login']);
    });

    this.creditCardForm = this.fb.group({
      card_name: ['', Validators.required],
      last_four_digits: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      card_limit: [0, [Validators.required, Validators.min(0)]],
      utilized_amount: [0, [Validators.required, Validators.min(0)]],
      billing_cycle_day: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
      due_date: ['', Validators.required],
      due_amount: [0, [Validators.required, Validators.min(0)]],
      existing_card_id: [''],
    });

    // Set up effect to watch for month changes and reload data
    effect(() => {
      const currentMonth = this.monthStore.month();
      const prev = this.previousMonth();
      const userId = this.userId();

      if (!userId) return;

      if (!prev) {
        this.previousMonth.set(currentMonth);
        this.loadCreditCards();
        return;
      }

      if (currentMonth !== prev) {
        this.previousMonth.set(currentMonth);
        this.loadCreditCards();
      }
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

  async loadCreditCards() {
    const userId = this.userId();
    if (!userId) return;

    this.isCheckingData.set(true);
    try {
      const allCards = await this.creditCardsService.getCreditCards(userId);
      this.creditCards.set(allCards);

      // Load unique existing cards (excluding month-specific duplicates)
      const uniqueCards = this.getUniqueCards(allCards);
      this.existingCards.set(uniqueCards);
    } catch (error) {
      console.error('Error loading credit cards:', error);
    } finally {
      this.isCheckingData.set(false);
    }
  }

  private getUniqueCards(cards: CreditCard[]): CreditCard[] {
    const uniqueMap = new Map<string, CreditCard>();
    cards.forEach((card) => {
      const key = `${card.card_name}-${card.last_four_digits}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, card);
      }
    });
    return Array.from(uniqueMap.values());
  }

  openAddCard() {
    this.resetForm();
    this.isAddingNew.set(true);
    this.showAddCard.set(true);
  }

  closeAddCard() {
    this.showAddCard.set(false);
    this.selectedCardId.set(null);
    this.resetForm();
  }

  toggleCardSelection(cardId: string) {
    if (this.selectedCardId() === cardId) {
      this.selectedCardId.set(null);
    } else {
      this.selectedCardId.set(cardId);
    }
  }

  toggleCardFlip(cardId: string) {
    const flipped = this.flippedCards();
    if (flipped.has(cardId)) {
      flipped.delete(cardId);
    } else {
      flipped.add(cardId);
    }
    this.flippedCards.set(new Set(flipped));
  }

  isCardFlipped(cardId: string): boolean {
    return this.flippedCards().has(cardId);
  }

  async toggleCardHistory(card: CreditCard, event: Event) {
    event.stopPropagation();
    
    if (this.showHistoryForCard() === card.id) {
      // Close history if already open
      this.showHistoryForCard.set(null);
      this.cardHistory.set([]);
      return;
    }

    // Show history for this card
    this.showHistoryForCard.set(card.id!);
    this.isLoadingHistory.set(true);

    try {
      const userId = this.userId();
      if (!userId) return;

      // Get all entries for this specific card (matching name and last 4 digits)
      const allCards = await this.creditCardsService.getCreditCards(userId);
      const history = allCards
        .filter((c) => 
          c.card_name === card.card_name && 
          c.last_four_digits === card.last_four_digits
        )
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
      
      this.cardHistory.set(history);
    } catch (error) {
      console.error('Error loading card history:', error);
    } finally {
      this.isLoadingHistory.set(false);
    }
  }

  onCardTypeChange() {
    const isAddingNew = this.isAddingNew();
    if (!isAddingNew) {
      // User wants to select existing card
      this.creditCardForm.patchValue({
        card_name: '',
        last_four_digits: '',
        card_limit: 0,
        utilized_amount: 0,
        billing_cycle_day: 1,
        due_date: '',
        due_amount: 0,
      });
    } else {
      // User wants to add new card
      this.creditCardForm.patchValue({
        existing_card_id: '',
      });
    }
  }

  onExistingCardSelect(event: any) {
    const cardId = event.target.value;
    if (!cardId) {
      this.selectedExistingCard.set(null);
      this.cardAction.set('');
      return;
    }

    const card = this.existingCards().find((c) => c.id === cardId);
    if (card) {
      this.selectedExistingCard.set(card);
      this.cardAction.set('');
      // Populate all fields as read-only reference, only utilized_amount will be editable
      this.creditCardForm.patchValue({
        card_name: card.card_name,
        last_four_digits: card.last_four_digits,
        card_limit: card.card_limit.toLocaleString('en-IN'),
        utilized_amount: 0, // Reset for monthly entry
        billing_cycle_day: card.billing_cycle_day,
        due_date: '',
        due_amount: 0,
      });
    }
  }

  onCardActionChange(action: 'edit' | 'delete') {
    this.cardAction.set(action);
    const card = this.selectedExistingCard();
    if (!card) return;

    if (action === 'edit') {
      // Enable all fields for editing the card template
      this.creditCardForm.patchValue({
        card_name: card.card_name,
        last_four_digits: card.last_four_digits,
        card_limit: card.card_limit.toLocaleString('en-IN'),
        utilized_amount: card.utilized_amount.toLocaleString('en-IN'),
        billing_cycle_day: card.billing_cycle_day,
        due_date: card.due_date,
        due_amount: card.due_amount.toLocaleString('en-IN'),
      });
    }
  }

  async executeCardAction() {
    const action = this.cardAction();
    const card = this.selectedExistingCard();
    
    if (!card || !action) return;

    if (action === 'delete') {
      await this.deleteCardTemplate(card.id!);
    } else if (action === 'edit') {
      await this.updateCardTemplate();
    }
  }

  async deleteCardTemplate(cardId: string) {
    if (confirm('This will delete the card template. Are you sure?')) {
      try {
        await this.creditCardsService.deleteCreditCard(cardId);
        await this.loadCreditCards();
        this.resetForm();
        this.selectedExistingCard.set(null);
        this.cardAction.set('');
        alert('Card template deleted successfully');
      } catch (error) {
        console.error('Error deleting card template:', error);
        alert('Failed to delete card template.');
      }
    }
  }

  async updateCardTemplate() {
    if (this.creditCardForm.invalid) return;

    const form = this.creditCardForm.value;
    const card = this.selectedExistingCard();
    if (!card) return;

    const cardLimit = typeof form.card_limit === 'string'
      ? parseInt(form.card_limit.replace(/,/g, ''), 10) || 0
      : form.card_limit;

    const utilizedAmount = typeof form.utilized_amount === 'string'
      ? parseInt(form.utilized_amount.replace(/,/g, ''), 10) || 0
      : form.utilized_amount;

    const dueAmount = typeof form.due_amount === 'string'
      ? parseInt(form.due_amount.replace(/,/g, ''), 10) || 0
      : form.due_amount;

    try {
      await this.creditCardsService.updateCreditCard(card.id!, {
        card_name: form.card_name,
        last_four_digits: form.last_four_digits,
        card_limit: cardLimit,
        utilized_amount: utilizedAmount,
        billing_cycle_day: form.billing_cycle_day,
        due_date: form.due_date,
        due_amount: dueAmount,
      });

      await this.loadCreditCards();
      this.resetForm();
      this.selectedExistingCard.set(null);
      this.cardAction.set('');
      this.closeAddCard();
      alert('Card template updated successfully');
    } catch (error) {
      console.error('Error updating card template:', error);
      alert('Failed to update card template.');
    }
  }

  onAmountChange(event: any, controlName: string) {
    const inputValue = event.target.value;
    let numericValue = inputValue.replace(/[^\d]/g, '');

    if (numericValue === '') {
      event.target.value = '';
      this.creditCardForm.get(controlName)?.setValue('', { emitEvent: false });
      return;
    }

    const num = parseInt(numericValue, 10);
    if (!isNaN(num)) {
      const formatted = num.toLocaleString('en-IN');
      event.target.value = formatted;
      this.creditCardForm.get(controlName)?.setValue(formatted, { emitEvent: false });
    }
  }

  async submitCreditCard() {
    const action = this.cardAction();
    
    // If user selected an action (edit/delete), execute that instead
    if (action) {
      await this.executeCardAction();
      return;
    }

    if (this.creditCardForm.invalid) {
      return;
    }

    const form = this.creditCardForm.value;
    const monthYear = this.monthStore.month();
    const userId = this.userId();

    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    const cardLimit = typeof form.card_limit === 'string'
      ? parseInt(form.card_limit.replace(/,/g, ''), 10) || 0
      : form.card_limit;

    const utilizedAmount = typeof form.utilized_amount === 'string'
      ? parseInt(form.utilized_amount.replace(/,/g, ''), 10) || 0
      : form.utilized_amount;

    const dueAmount = typeof form.due_amount === 'string'
      ? parseInt(form.due_amount.replace(/,/g, ''), 10) || 0
      : form.due_amount;

    const editingId = this.editingCardId();

    try {
      if (editingId) {
        // Update existing monthly card entry
        await this.creditCardsService.updateCreditCard(editingId, {
          card_name: form.card_name,
          last_four_digits: form.last_four_digits,
          card_limit: cardLimit,
          utilized_amount: utilizedAmount,
          billing_cycle_day: form.billing_cycle_day,
          due_date: form.due_date,
          due_amount: dueAmount,
          month_year: monthYear,
        });
      } else {
        // Create new card (either brand new or monthly entry from existing)
        await this.creditCardsService.createCreditCard({
          user_id: userId,
          card_name: form.card_name,
          last_four_digits: form.last_four_digits,
          card_limit: cardLimit,
          utilized_amount: utilizedAmount,
          billing_cycle_day: form.billing_cycle_day,
          due_date: form.due_date,
          due_amount: dueAmount,
          month_year: monthYear,
        });
      }

      await this.loadCreditCards();
      this.resetForm();
      this.closeAddCard();
    } catch (error) {
      console.error('Error saving credit card:', error);
      alert('Failed to save credit card. Please try again.');
    }
  }

  async deleteCard(cardId: string) {
    if (confirm('Are you sure you want to delete this credit card?')) {
      try {
        await this.creditCardsService.deleteCreditCard(cardId);
        await this.loadCreditCards();
      } catch (error) {
        console.error('Error deleting credit card:', error);
        alert('Failed to delete credit card. Please try again.');
      }
    }
  }

  editCard(card: CreditCard) {
    this.editingCardId.set(card.id || null);
    this.isAddingNew.set(true);
    this.creditCardForm.patchValue({
      card_name: card.card_name,
      last_four_digits: card.last_four_digits,
      card_limit: card.card_limit.toLocaleString('en-IN'),
      utilized_amount: card.utilized_amount.toLocaleString('en-IN'),
      billing_cycle_day: card.billing_cycle_day,
      due_date: card.due_date,
      due_amount: card.due_amount.toLocaleString('en-IN'),
    });
    this.showAddCard.set(true);
  }

  resetForm() {
    this.editingCardId.set(null);
    this.selectedExistingCard.set(null);
    this.cardAction.set('');
    this.creditCardForm.reset({
      card_name: '',
      last_four_digits: '',
      card_limit: 0,
      utilized_amount: 0,
      billing_cycle_day: 1,
      due_date: '',
      due_amount: 0,
      existing_card_id: '',
    });
  }

  formatIndianRupee(amount: number): string {
    if (!amount) return '0';
    return amount.toLocaleString('en-IN');
  }

  getMaskedCardNumber(lastFour: string): string {
    return `•••• •••• •••• ${lastFour}`;
  }

  getCardGradient(index: number): string {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    ];
    return gradients[index % gradients.length];
  }
}
