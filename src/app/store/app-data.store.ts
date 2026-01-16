import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { inject } from "@angular/core";
import { BudgetEntriesService, BudgetRecord } from "../services/budget-entries.service";
import { LoansService } from "../services/loans/loans.service";
import { CreditCardsService, CreditCard } from "../services/credit-cards.service";
import { SubscriptionsService, Subscription } from "../services/subscriptions.service";
import { GoldInvestmentsService, GoldInvestment } from "../services/gold-investments.service";
import { StocksMutualFundsService, FundSummary } from "../services/stocks-mutual-funds.service";
import { PostOfficeSchemesService, PostOfficeScheme } from "../services/post-office-schemes.service";

interface AppDataState {
  // Budget data
  budgetEntries: BudgetRecord[];
  budgetLoaded: boolean;
  budgetError: string | null;
  
  // Loans data
  loans: any[];
  loansLoaded: boolean;
  loansError: string | null;
  
  // Credit Cards data
  creditCards: CreditCard[];
  creditCardsLoaded: boolean;
  creditCardsError: string | null;
  
  // Subscriptions data
  subscriptions: Subscription[];
  subscriptionsLoaded: boolean;
  subscriptionsError: string | null;
  
  // Gold Investments data
  goldInvestments: GoldInvestment[];
  goldInvestmentsLoaded: boolean;
  goldInvestmentsError: string | null;
  
  // Mutual Funds data
  mutualFunds: FundSummary[];
  mutualFundsLoaded: boolean;
  mutualFundsError: string | null;
  
  // Post Office Schemes data
  postOfficeSchemes: PostOfficeScheme[];
  postOfficeSchemesLoaded: boolean;
  postOfficeSchemesError: string | null;
  
  // Loading state for initial dashboard load
  isInitialLoadComplete: boolean;
  currentUserId: string | null;
}

const initialState: AppDataState = {
  budgetEntries: [],
  budgetLoaded: false,
  budgetError: null,
  
  loans: [],
  loansLoaded: false,
  loansError: null,
  
  creditCards: [],
  creditCardsLoaded: false,
  creditCardsError: null,
  
  subscriptions: [],
  subscriptionsLoaded: false,
  subscriptionsError: null,
  
  goldInvestments: [],
  goldInvestmentsLoaded: false,
  goldInvestmentsError: null,
  
  mutualFunds: [],
  mutualFundsLoaded: false,
  mutualFundsError: null,
  
  postOfficeSchemes: [],
  postOfficeSchemesLoaded: false,
  postOfficeSchemesError: null,
  
  isInitialLoadComplete: false,
  currentUserId: null,
};

export const AppDataStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  
  withMethods((store) => {
    const budgetEntriesService = inject(BudgetEntriesService);
    const loansService = inject(LoansService);
    const creditCardsService = inject(CreditCardsService);
    const subscriptionsService = inject(SubscriptionsService);
    const goldInvestmentsService = inject(GoldInvestmentsService);
    const stocksMutualFundsService = inject(StocksMutualFundsService);
    const postOfficeSchemesService = inject(PostOfficeSchemesService);

    return {
      // Set current user
      setCurrentUserId(userId: string) {
        patchState(store, { currentUserId: userId });
      },

      // Mark initial load as complete
      setInitialLoadComplete(complete: boolean) {
        patchState(store, { isInitialLoadComplete: complete });
      },

      // Budget methods
      setBudgetEntries(entries: BudgetRecord[]) {
        patchState(store, { 
          budgetEntries: entries,
          budgetLoaded: true,
          budgetError: null
        });
      },

      setBudgetError(error: string | null) {
        patchState(store, { budgetError: error });
      },

      async loadBudgetEntries(userId: string, monthYears: string[]) {
        try {
          patchState(store, { budgetLoaded: false, budgetError: null });
          const entries = await budgetEntriesService.getBudgetEntriesByDateRange(monthYears, userId);
          this.setBudgetEntries(entries);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load budget entries';
          patchState(store, { budgetError: errorMsg, budgetLoaded: true });
          console.error('Error loading budget entries:', error);
        }
      },

      // Loans methods
      setLoans(loans: any[]) {
        patchState(store, {
          loans,
          loansLoaded: true,
          loansError: null
        });
      },

      setLoansError(error: string | null) {
        patchState(store, { loansError: error });
      },

      async loadLoans(userId: string) {
        if (store.loansLoaded() && store.currentUserId() === userId) {
          return; // Data already loaded for this user
        }
        try {
          patchState(store, { loansLoaded: false, loansError: null });
          const loans = await loansService.getLoansByUser(userId);
          const transformedLoans = loans.map((loan: any) => ({
            id: loan.id,
            loanName: loan.loan_name,
            monthlyEMI: loan.monthly_emi,
            interest: loan.interest,
            totalTenure: loan.total_tenure,
            paidMonths: loan.paid_months || 0,
            monthlyDueDate: loan.monthly_due_date,
            emoji: loan.emoji || '💰',
            createdAt: loan.created_at,
            updatedAt: loan.updated_at,
          }));
          this.setLoans(transformedLoans);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load loans';
          patchState(store, { loansError: errorMsg, loansLoaded: true });
          console.error('Error loading loans:', error);
        }
      },

      // Credit Cards methods
      setCreditCards(cards: CreditCard[]) {
        patchState(store, {
          creditCards: cards,
          creditCardsLoaded: true,
          creditCardsError: null
        });
      },

      setCreditCardsError(error: string | null) {
        patchState(store, { creditCardsError: error });
      },

      async loadCreditCards(userId: string) {
        if (store.creditCardsLoaded() && store.currentUserId() === userId) {
          return; // Data already loaded for this user
        }
        try {
          patchState(store, { creditCardsLoaded: false, creditCardsError: null });
          const cards = await creditCardsService.getCreditCards(userId);
          this.setCreditCards(cards);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load credit cards';
          patchState(store, { creditCardsError: errorMsg, creditCardsLoaded: true });
          console.error('Error loading credit cards:', error);
        }
      },

      // Subscriptions methods
      setSubscriptions(subs: Subscription[]) {
        patchState(store, {
          subscriptions: subs,
          subscriptionsLoaded: true,
          subscriptionsError: null
        });
      },

      setSubscriptionsError(error: string | null) {
        patchState(store, { subscriptionsError: error });
      },

      async loadSubscriptions(userId: string) {
        if (store.subscriptionsLoaded() && store.currentUserId() === userId) {
          return; // Data already loaded for this user
        }
        try {
          patchState(store, { subscriptionsLoaded: false, subscriptionsError: null });
          const subs = await subscriptionsService.getSubscriptions(userId);
          this.setSubscriptions(subs);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load subscriptions';
          patchState(store, { subscriptionsError: errorMsg, subscriptionsLoaded: true });
          console.error('Error loading subscriptions:', error);
        }
      },

      // Gold Investments methods
      setGoldInvestments(investments: GoldInvestment[]) {
        patchState(store, {
          goldInvestments: investments,
          goldInvestmentsLoaded: true,
          goldInvestmentsError: null
        });
      },

      setGoldInvestmentsError(error: string | null) {
        patchState(store, { goldInvestmentsError: error });
      },

      async loadGoldInvestments(userId: string) {
        if (store.goldInvestmentsLoaded() && store.currentUserId() === userId) {
          return; // Data already loaded for this user
        }
        try {
          patchState(store, { goldInvestmentsLoaded: false, goldInvestmentsError: null });
          const investments = await goldInvestmentsService.getGoldInvestments(userId);
          this.setGoldInvestments(investments);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load gold investments';
          patchState(store, { goldInvestmentsError: errorMsg, goldInvestmentsLoaded: true });
          console.error('Error loading gold investments:', error);
        }
      },

      // Mutual Funds methods
      setMutualFunds(funds: FundSummary[]) {
        patchState(store, {
          mutualFunds: funds,
          mutualFundsLoaded: true,
          mutualFundsError: null
        });
      },

      setMutualFundsError(error: string | null) {
        patchState(store, { mutualFundsError: error });
      },

      async loadMutualFunds(userId: string) {
        if (store.mutualFundsLoaded() && store.currentUserId() === userId) {
          return; // Data already loaded for this user
        }
        try {
          patchState(store, { mutualFundsLoaded: false, mutualFundsError: null });
          const funds = await stocksMutualFundsService.getFundsSummary(userId);
          this.setMutualFunds(funds);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load mutual funds';
          patchState(store, { mutualFundsError: errorMsg, mutualFundsLoaded: true });
          console.error('Error loading mutual funds:', error);
        }
      },

      // Post Office Schemes methods
      setPostOfficeSchemes(schemes: PostOfficeScheme[]) {
        patchState(store, {
          postOfficeSchemes: schemes,
          postOfficeSchemesLoaded: true,
          postOfficeSchemesError: null
        });
      },

      setPostOfficeSchemesError(error: string | null) {
        patchState(store, { postOfficeSchemesError: error });
      },

      async loadPostOfficeSchemes(userId: string) {
        if (store.postOfficeSchemesLoaded() && store.currentUserId() === userId) {
          return; // Data already loaded for this user
        }
        try {
          patchState(store, { postOfficeSchemesLoaded: false, postOfficeSchemesError: null });
          const schemes = await postOfficeSchemesService.getPostOfficeSchemes(userId);
          this.setPostOfficeSchemes(schemes);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load post office schemes';
          patchState(store, { postOfficeSchemesError: errorMsg, postOfficeSchemesLoaded: true });
          console.error('Error loading post office schemes:', error);
        }
      },

      // Load all data at once (useful for dashboard on first load)
      async loadAllData(userId: string, monthYears: string[]) {
        this.setCurrentUserId(userId);
        
        try {
          await Promise.all([
            this.loadBudgetEntries(userId, monthYears),
            this.loadLoans(userId),
            this.loadCreditCards(userId),
            this.loadSubscriptions(userId),
            this.loadGoldInvestments(userId),
            this.loadMutualFunds(userId),
            this.loadPostOfficeSchemes(userId),
          ]);
          
          this.setInitialLoadComplete(true);
        } catch (error) {
          console.error('Error loading all data:', error);
          this.setInitialLoadComplete(true);
        }
      },

      // Check if data needs refresh for user
      needsRefresh(userId: string): boolean {
        return store.currentUserId() !== userId;
      },

      // Clear store data when user logs out
      clearAllData() {
        patchState(store, {
          budgetEntries: [],
          budgetLoaded: false,
          loans: [],
          loansLoaded: false,
          creditCards: [],
          creditCardsLoaded: false,
          subscriptions: [],
          subscriptionsLoaded: false,
          goldInvestments: [],
          goldInvestmentsLoaded: false,
          mutualFunds: [],
          mutualFundsLoaded: false,
          postOfficeSchemes: [],
          postOfficeSchemesLoaded: false,
          isInitialLoadComplete: false,
          currentUserId: null,
        });
      },
    };
  })
);
