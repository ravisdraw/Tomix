import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';

export interface DoughnutChartDataset {
  label?: string;
  data: number[];
  backgroundColor?: string[];
  borderColor?: string[];
  borderWidth?: number;
}

export interface DoughnutChartConfig {
  labels: string[];
  datasets: DoughnutChartDataset[];
  options?: any;
}

@Component({
  selector: 'app-doughnut-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <canvas
      baseChart
      type="doughnut"
      [data]="chartData"
      [options]="chartOptions"
    ></canvas>
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class DoughnutChartComponent {
  @Input() chartData: any = { labels: [], datasets: [] };
  @Input() chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        display: window.innerWidth >= 1536, // 2xl breakpoint (1536px), false for smaller screens
      },
    },
  };
}
