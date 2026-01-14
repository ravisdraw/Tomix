import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { LoansService } from "../services/loans/loans.service";
import { inject } from "@angular/core";

const initialState = { loans: [] as any[], loading: false, error: null as string | null };

export const LoansStore = signalStore(
    { providedIn: 'root' },

    withState(initialState),

    withMethods((store) => {
      const loansService = inject(LoansService);

      return {
        setLoans(loans: any[]) {
          patchState(store, { loans });
        },

        setLoading(loading: boolean) {
          patchState(store, { loading });
        },

        setError(error: string | null) {
          patchState(store, { error });
        },

        async loadLoansByUser(userId: string) {
          try {
            this.setLoading(true);
            this.setError(null);
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
          } catch (err) {
            this.setError(err instanceof Error ? err.message : 'Failed to load loans');
            console.error('Error loading loans:', err);
          } finally {
            this.setLoading(false);
          }
        },

        async saveLoan(loan: any, userId: string) {
          try {
            this.setLoading(true);
            this.setError(null);
            
            const dbLoan = {
              user_id: userId,
              loan_name: loan.loanName,
              monthly_emi: loan.monthlyEMI,
              interest: loan.interest,
              total_tenure: loan.totalTenure,
              paid_months: loan.paidMonths || 0,
              monthly_due_date: loan.monthlyDueDate,
              emoji: loan.emoji || '💰',
            };

            const savedLoan = await loansService.saveLoan(dbLoan);
            
            const transformedLoan = {
              id: savedLoan.id,
              loanName: savedLoan.loan_name,
              monthlyEMI: savedLoan.monthly_emi,
              interest: savedLoan.interest,
              totalTenure: savedLoan.total_tenure,
              paidMonths: savedLoan.paid_months || 0,
              monthlyDueDate: savedLoan.monthly_due_date,
              emoji: savedLoan.emoji,
              createdAt: savedLoan.created_at,
              updatedAt: savedLoan.updated_at,
            };

            return transformedLoan;
          } catch (err) {
            this.setError(err instanceof Error ? err.message : 'Failed to save loan');
            console.error('Error saving loan:', err);
            throw err;
          } finally {
            this.setLoading(false);
          }
        },

        async updateLoan(id: string, updates: any) {
          try {
            this.setLoading(true);
            this.setError(null);
            
            const dbUpdates = {
              loan_name: updates.loanName,
              monthly_emi: updates.monthlyEMI,
              interest: updates.interest,
              total_tenure: updates.totalTenure,
              paid_months: updates.paidMonths,
              monthly_due_date: updates.monthlyDueDate,
              emoji: updates.emoji,
            };

            const updatedLoan = await loansService.updateLoan(id, dbUpdates);
            
            const transformedLoan = {
              id: updatedLoan.id,
              loanName: updatedLoan.loan_name,
              monthlyEMI: updatedLoan.monthly_emi,
              interest: updatedLoan.interest,
              totalTenure: updatedLoan.total_tenure,
              paidMonths: updatedLoan.paid_months || 0,
              monthlyDueDate: updatedLoan.monthly_due_date,
              emoji: updatedLoan.emoji,
              createdAt: updatedLoan.created_at,
              updatedAt: updatedLoan.updated_at,
            };

            return transformedLoan;
          } catch (err) {
            this.setError(err instanceof Error ? err.message : 'Failed to update loan');
            console.error('Error updating loan:', err);
            throw err;
          } finally {
            this.setLoading(false);
          }
        },

        async deleteLoan(id: string) {
          try {
            this.setLoading(true);
            this.setError(null);
            
            await loansService.deleteLoan(id);
          } catch (err) {
            this.setError(err instanceof Error ? err.message : 'Failed to delete loan');
            console.error('Error deleting loan:', err);
            throw err;
          } finally {
            this.setLoading(false);
          }
        },
      };
    })
);
