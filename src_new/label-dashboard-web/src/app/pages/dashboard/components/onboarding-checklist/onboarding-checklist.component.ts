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
  @Input() featureMusicReleases: boolean = true;

  get items() {
    const items = [
      { label: 'Update your profile',            route: '/artist/profile',      done: this.checklist.hasProfile },
      { label: 'Upload photos to your gallery',  route: '/artist/gallery',      done: this.checklist.hasGalleryPhotos },
    ];
    if (this.featureMusicReleases) {
      items.push(
        { label: 'Set up your payout account', route: '/financial/payments',  done: this.checklist.hasSettlementAccount },
        { label: 'Create your first release',  route: '/music/releases/new',  done: this.checklist.hasRelease }
      );
    }
    return items;
  }

  get completedCount(): number {
    return this.items.filter(i => i.done).length;
  }

  get isAllDone(): boolean {
    return this.completedCount === this.items.length;
  }
}
