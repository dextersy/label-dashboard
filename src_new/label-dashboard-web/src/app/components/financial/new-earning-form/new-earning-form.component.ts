import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-new-earning-form',
    imports: [CommonModule, FormsModule],
    templateUrl: './new-earning-form.component.html',
    styleUrl: './new-earning-form.component.scss'
})
export class NewEarningFormComponent {
  @Input() newEarningForm: any = {};
  @Input() releases: any[] = [];
  @Input() onSubmitEarning: () => Promise<void> = async () => {};
  @Input() isLoading: boolean = false;

  formatReleaseOption(release: any): string {
    return `${release.catalog_no} : ${release.title}`;
  }
}