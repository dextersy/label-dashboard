import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

export interface PipelineStage {
  status: string;
  count: number;
}

const FLOW_ORDER = ['Draft', 'For Submission', 'Pending', 'Live'];

@Component({
  selector: 'app-release-pipeline',
  imports: [CommonModule, IconComponent],
  templateUrl: './release-pipeline.component.html',
  styleUrl: './release-pipeline.component.scss'
})
export class ReleasePipelineComponent {
  @Input() stages: PipelineStage[] = [];

  constructor(private router: Router) {}

  get total(): number {
    return this.stages.reduce((sum, s) => sum + s.count, 0);
  }

  get flowStages(): PipelineStage[] {
    return FLOW_ORDER.map(
      name => this.stages.find(s => s.status === name) ?? { status: name, count: 0 }
    );
  }

  get takenDown(): PipelineStage {
    return this.stages.find(s => s.status === 'Taken Down') ?? { status: 'Taken Down', count: 0 };
  }

  get distributionStages(): PipelineStage[] {
    return [...this.flowStages, this.takenDown].filter(s => s.count > 0);
  }

  getPct(count: number): number {
    if (this.total === 0) return 0;
    return Math.round((count / this.total) * 100);
  }

  getStatusKey(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  getIcon(status: string): string {
    const icons: Record<string, string> = {
      'Draft':          'edit',
      'For Submission': 'paper-plane',
      'Pending':        'hourglass',
      'Live':           'broadcast',
      'Taken Down':     'ban'
    };
    return icons[status] ?? 'circle-dot';
  }

  goToReleases(): void {
    this.router.navigate(['/music/releases']);
  }
}
