import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

type MonthState = {
  month: string;
};

function getCurrentMonthYear(): string {
  const date = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${month} ${year}`;
}

const initialState: MonthState = { month: getCurrentMonthYear() };

export const MonthStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),
  withMethods((store) => ({
    setMonth(month: string) {
      patchState(store, { month });
    },
  }))
);
