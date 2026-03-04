import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinancialService } from '../../../services/financial.service';

@Component({
    selector: 'app-new-earning-form',
    imports: [CommonModule, FormsModule],
    templateUrl: './new-earning-form.component.html',
    styleUrl: './new-earning-form.component.scss'
})
export class NewEarningFormComponent implements OnChanges {
  @Input() newEarningForm: any = {};
  @Input() releases: any[] = [];
  @Input() onSubmitEarning: () => Promise<void> = async () => {};
  @Input() isLoading: boolean = false;

  songs: any[] = [];
  loadingSongs: boolean = false;

  constructor(private financialService: FinancialService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['newEarningForm'] && this.newEarningForm?.release_id) {
      this.loadSongsForRelease(this.newEarningForm.release_id);
    }
  }

  async onReleaseChange(): Promise<void> {
    this.newEarningForm.song_id = null;
    this.songs = [];
    if (this.newEarningForm.release_id) {
      await this.loadSongsForRelease(this.newEarningForm.release_id);
    }
  }

  private async loadSongsForRelease(releaseId: number): Promise<void> {
    if (!releaseId) return;
    this.loadingSongs = true;
    try {
      const data = await this.financialService.getSongCollaboratorRoyalties(releaseId);
      this.songs = (data?.songs || []).map((s: any) => ({
        id: s.song_id,
        title: s.title
      }));
    } catch (error) {
      this.songs = [];
    } finally {
      this.loadingSongs = false;
    }
  }

  formatReleaseOption(release: any): string {
    return `${release.catalog_no} : ${release.title}`;
  }
}
