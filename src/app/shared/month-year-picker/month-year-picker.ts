import { Component, EventEmitter, inject, Output, signal, computed, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { MonthStore } from '../../store/month.store';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-month-year-picker',
  imports: [CommonModule],
  templateUrl: './month-year-picker.html',
  styleUrl: './month-year-picker.css',
})
export class MonthYearPicker implements AfterViewInit {
  @ViewChild('monthScroll') monthScroll?: ElementRef;
  @ViewChild('container') container?: ElementRef;

  readonly monthStore = inject(MonthStore);
  
  selectedYear = signal(new Date().getFullYear());
  selectedMonth = signal(new Date().getMonth());
  monthOffset = signal(0);
  showPickerModal = signal(false);
  pickerViewYear = signal(new Date().getFullYear());
  pickerViewMonth = signal(new Date().getMonth());
  private outsideClickListener: ((event: MouseEvent) => void) | null = null;

  months = [
    'Jan', 'Feb', 'Mar',
    'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep',
    'Oct', 'Nov', 'Dec'
  ];

  // Generate dynamic list of months with offset
  monthList = computed(() => {
    const list = [];
    const today = new Date();
    const offset = this.monthOffset();
    for (let i = -6 + offset; i < 6 + offset; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const month = this.months[date.getMonth()];
      const year = date.getFullYear();
      list.push({ month, year, label: `${month} ${year}` });
    }
    return list;
  });

  ngAfterViewInit() {
    // this.setupScrollListener();
    this.setupOutsideClickListener();
  }

  setupOutsideClickListener() {
    this.outsideClickListener = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const container = this.container?.nativeElement;
      
      // Check if click is outside the month picker container
      if (container && !container.contains(target)) {
        this.scrollToSelectedMonth();
      }
    };
    
    // Use setTimeout to ensure the listener is added after the view is fully rendered
    setTimeout(() => {
      document.addEventListener('click', this.outsideClickListener!);
    }, 0);
  }

  scrollToSelectedMonth() {
    if (!this.monthScroll?.nativeElement) return;
    
    const scrollElement = this.monthScroll.nativeElement;
    const selectedButton = scrollElement.querySelector('.month-btn.active');
    
    if (selectedButton) {
      selectedButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  setupScrollListener() {
    if (!this.monthScroll?.nativeElement) return;
    
    const scrollElement = this.monthScroll.nativeElement;
    scrollElement.addEventListener('scroll', () => {
      // Check if scrolled to the right end
      if (scrollElement.scrollLeft + scrollElement.clientWidth >= scrollElement.scrollWidth - 50) {
        this.monthOffset.update(offset => {
          const newOffset = offset + 6;
          // Limit to maximum 6 months ahead
          return newOffset <= 6 ? newOffset : offset;
        });
      }
      
      // Check if scrolled to the left end
      if (scrollElement.scrollLeft <= 50) {
        this.monthOffset.update(offset => {
          const newOffset = offset - 6;
          // Limit to maximum 6 months behind
          return newOffset >= -6 ? newOffset : offset;
        });
      }
    });
  }

  selectMonth(month: string, year: number) {
    this.selectedMonth.set(this.months.indexOf(month));
    this.selectedYear.set(year);
    let date = `${month} ${year}`;
    this.monthStore.setMonth(date);
  }

  openPickerModal() {
    this.pickerViewYear.set(this.selectedYear());
    this.pickerViewMonth.set(this.selectedMonth());
    this.showPickerModal.set(true);
  }

  closePickerModal() {
    this.showPickerModal.set(false);
  }

  prevYear() {
    this.pickerViewYear.update(y => y - 1);
  }

  nextYear() {
    this.pickerViewYear.update(y => y + 1);
  }

  selectMonthFromPicker(monthIndex: number) {
    const month = this.months[monthIndex];
    const year = this.pickerViewYear();
    this.selectMonth(month, year);
    this.closePickerModal();
    this.monthOffset.set(0); // Reset offset to show selected month
  }
}

