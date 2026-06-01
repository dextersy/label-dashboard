import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconComponent } from '../../../../components/shared/icon/icon.component';

export interface DashboardChecklist {
  hasProfile: boolean;
  hasGalleryPhotos: boolean;
  hasSettlementAccount: boolean;
  hasRelease: boolean;
}

@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule, RouterModule, IconComponent],
  templateUrl: './onboarding-checklist.component.html'
})
export class OnboardingChecklistComponent {
  @Input() checklist!: DashboardChecklist;

  get items() {
    return [
      { label: 'Update your profile',            route: '/artist/profile',      done: this.checklist.hasProfile },
      { label: 'Upload photos to your gallery',  route: '/artist/gallery',      done: this.checklist.hasGalleryPhotos },
      { label: 'Set up your settlement account', route: '/financial/payments',  done: this.checklist.hasSettlementAccount },
      { label: 'Create your first release',      route: '/music/releases/new',  done: this.checklist.hasRelease }
    ];
  }

  get completedCount(): number {
    return this.items.filter(i => i.done).length;
  }

  get isAllDone(): boolean {
    return this.completedCount === 4;
  }
}
