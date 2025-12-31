import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthYearPicker } from './month-year-picker';

describe('MonthYearPicker', () => {
  let component: MonthYearPicker;
  let fixture: ComponentFixture<MonthYearPicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthYearPicker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthYearPicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
