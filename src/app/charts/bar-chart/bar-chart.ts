import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';

export interface BarChartDataset {
  label: string;
  data: number[];
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
}

export interface BarChartConfig {
  labels: string[];
  datasets: BarChartDataset[];
  options?: any;
}

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  template: `
    <canvas
      baseChart
      type="bar"
      [data]="chartData"
      [options]="chartOptions"
    ></canvas>
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class BarChartComponent {
  @Input() chartData: any = { labels: [], datasets: [] };
  @Input() chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        display: window.innerWidth >= 1536, // 2xl breakpoint (1536px), false for smaller screens
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: string | number) {
            return '₹' + Number(value).toLocaleString('en-IN');
          },
        },
      },
    },
  };
}
