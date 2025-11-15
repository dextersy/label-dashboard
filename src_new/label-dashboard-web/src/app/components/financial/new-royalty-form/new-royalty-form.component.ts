import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-new-royalty-form',
    imports: [CommonModule, FormsModule],
    templateUrl: './new-royalty-form.component.html',
    styleUrl: './new-royalty-form.component.scss'
})
export class NewRoyaltyFormComponent {
  @Input() newRoyaltyForm: any = {};
  @Input() releases: any[] = [];
  @Input() onSubmitRoyalty: () => Promise<void> = async () => {};
  @Input() isLoading: boolean = false;

  formatReleaseOption(release: any): string {
    return `${release.catalog_no} : ${release.title}`;
  }
}