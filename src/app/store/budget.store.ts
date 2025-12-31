import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { BudgetEntriesService } from "../services/budget-entries.service";
import { inject } from "@angular/core";

const initialState = { budget : {}, loading: false, error: null as string | null };

export const BudgetStore = signalStore(
    { providedIn: 'root' },

    withState(initialState),

    withMethods((store) => {
      const budgetEntriesService = inject(BudgetEntriesService);

      return {
        setBudget(budget: any) {
          patchState(store, { budget });
        },

        setLoading(loading: boolean) {
          patchState(store, { loading });
        },

        setError(error: string | null) {
          patchState(store, { error });
        },

        async loadBudgetByMonth(monthYear: string, userId: string) {
          try {
            this.setLoading(true);
            this.setError(null);
            const entries = await budgetEntriesService.getBudgetEntriesByMonth(monthYear, userId);
            
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
            }));
            
            // Transform flat array into organized budget object
            const budget: Record<string, any> = {};
            budget[monthYear.split(' ').join('')] = {
              income: transformedEntries.filter(e => e.type === 'income'),
              expenses: transformedEntries.filter(e => e.type === 'expense')
            };
            
            this.setBudget(budget);
          } catch (err) {
            this.setError(err instanceof Error ? err.message : 'Failed to load budget');
            console.error('Error loading budget:', err);
          } finally {
            this.setLoading(false);
          }
        },

        async saveBudgetEntry(entry: any, userId: string) {
          try {
            this.setLoading(true);
            this.setError(null);
            
            const dbEntry = {
              user_id: userId,
              month_year: entry.monthYear,
              expense_name: entry.expenseName,
              emoji: entry.emoji,
              amount: entry.amount,
              type: entry.type,
              category: entry.category,
              bank_account: entry.bankAccount,
              carry_forward: entry.carryForward || false,
            };

            const savedEntry = await budgetEntriesService.saveBudgetEntry(dbEntry);
            return savedEntry;
          } catch (err) {
            this.setError(err instanceof Error ? err.message : 'Failed to save entry');
            console.error('Error saving budget entry:', err);
            throw err;
          } finally {
            this.setLoading(false);
          }
        },

        async updateBudgetEntry(id: string, updates: any) {
          try {
            this.setLoading(true);
            this.setError(null);
            
            const updatedEntry = await budgetEntriesService.updateBudgetEntry(id, updates);
            return updatedEntry;
          } catch (err) {
            this.setError(err instanceof Error ? err.message : 'Failed to update entry');
            console.error('Error updating budget entry:', err);
            throw err;
          } finally {
            this.setLoading(false);
          }
        },

        async deleteBudgetEntry(id: string) {
          try {
            this.setLoading(true);
            this.setError(null);
            
            await budgetEntriesService.deleteBudgetEntry(id);
          } catch (err) {
            this.setError(err instanceof Error ? err.message : 'Failed to delete entry');
            console.error('Error deleting budget entry:', err);
            throw err;
          } finally {
            this.setLoading(false);
          }
        }
      };
    })
);