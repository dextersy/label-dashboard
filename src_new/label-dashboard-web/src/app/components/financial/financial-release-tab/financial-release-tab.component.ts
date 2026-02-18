import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReleaseInfo } from '../../../pages/financial/financial.component';
import { ReleaseExpensesDialogComponent } from '../release-expenses-dialog/release-expenses-dialog.component';
import { AddExpenseDialogComponent } from '../add-expense-dialog/add-expense-dialog.component';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';

interface SongCollaboratorRoyalty {
  id: number;
  artist_id: number;
  artist_name: string;
  streaming_royalty_percentage: number;
  streaming_royalty_type: string;
  sync_royalty_percentage: number;
  sync_royalty_type: string;
  download_royalty_percentage: number;
  download_royalty_type: string;
  physical_royalty_percentage: number;
  physical_royalty_type: string;
}

interface SongWithCollaborators {
  song_id: number;
  title: string;
  track_number: number;
  collaborators: SongCollaboratorRoyalty[];
}

@Component({
    selector: 'app-financial-release-tab',
    imports: [CommonModule, FormsModule, ReleaseExpensesDialogComponent, AddExpenseDialogComponent],
    templateUrl: './financial-release-tab.component.html',
    styleUrl: './financial-release-tab.component.scss'
})
export class FinancialReleaseTabComponent {
  @Input() releases: ReleaseInfo[] = [];
  @Input() isAdmin: boolean = false;
  @Input() editingRoyalties: boolean = false;
  @Input() updatingRoyalties: boolean = false;
  @Input() toggleEditRoyalties: () => void = () => {};
  @Input() onUpdateRoyalties: () => Promise<void> = async () => {};
  @Input() onAddExpense: (expenseData: any) => Promise<void> = async () => {};

  expensesDialogVisible = false;
  selectedReleaseId = 0;
  selectedReleaseTitle = '';
  addExpenseDialogVisible = false;
  addExpenseReleaseId = 0;
  addExpenseReleaseTitle = '';
  isSubmittingExpense = false;

  // Song collaborator royalties
  expandedReleaseIds: Set<number> = new Set();
  songDataByRelease: Map<number, SongWithCollaborators[]> = new Map();
  loadingSongData: Set<number> = new Set();
  editingSongRoyalties: boolean = false;
  updatingSongRoyalties: boolean = false;
  songRoyaltyReleaseId: number = 0;

  constructor(
    private financialService: FinancialService,
    private notificationService: NotificationService
  ) {}

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }

  getAmountClass(amount: number | undefined): string {
    return amount !== undefined && amount < 0 ? 'text-danger' : '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-PH');
  }

  formatPercentage(value: number): number {
    return Math.round(value * 100);
  }

  onPercentageChange(release: ReleaseInfo, field: string, event: any): void {
    const value = parseFloat(event.target.value) / 100;
    (release as any)[field] = value;
  }

  async updateRoyalties(): Promise<void> {
    await this.onUpdateRoyalties();
  }

  openExpensesDialog(releaseId: number, releaseTitle: string): void {
    this.selectedReleaseId = releaseId;
    this.selectedReleaseTitle = releaseTitle;
    this.expensesDialogVisible = true;
  }

  closeExpensesDialog(): void {
    this.expensesDialogVisible = false;
    this.selectedReleaseId = 0;
    this.selectedReleaseTitle = '';
  }

  openAddExpenseDialog(releaseId: number, releaseTitle: string): void {
    this.addExpenseReleaseId = releaseId;
    this.addExpenseReleaseTitle = releaseTitle;
    this.addExpenseDialogVisible = true;
  }

  closeAddExpenseDialog(): void {
    this.addExpenseDialogVisible = false;
    this.addExpenseReleaseId = 0;
    this.addExpenseReleaseTitle = '';
    this.isSubmittingExpense = false;
  }

  async onSubmitExpense(expenseData: any): Promise<void> {
    this.isSubmittingExpense = true;
    try {
      await this.onAddExpense(expenseData);
      this.closeAddExpenseDialog();
    } catch (error) {
      this.isSubmittingExpense = false;
    }
  }

  // Song collaborator royalty methods
  isReleaseExpanded(releaseId: number): boolean {
    return this.expandedReleaseIds.has(releaseId);
  }

  isLoadingSongData(releaseId: number): boolean {
    return this.loadingSongData.has(releaseId);
  }

  async toggleSongSplits(releaseId: number): Promise<void> {
    if (this.expandedReleaseIds.has(releaseId)) {
      this.expandedReleaseIds.delete(releaseId);
      return;
    }

    this.expandedReleaseIds.add(releaseId);

    // Load data if not cached
    if (!this.songDataByRelease.has(releaseId)) {
      await this.loadSongCollaboratorRoyalties(releaseId);
    }
  }

  private async loadSongCollaboratorRoyalties(releaseId: number): Promise<void> {
    this.loadingSongData.add(releaseId);
    try {
      const data = await this.financialService.getSongCollaboratorRoyalties(releaseId);
      this.songDataByRelease.set(releaseId, data.songs || []);
    } catch (error) {
      console.error('Error loading song collaborator royalties:', error);
      this.songDataByRelease.set(releaseId, []);
    } finally {
      this.loadingSongData.delete(releaseId);
    }
  }

  getSongsForRelease(releaseId: number): SongWithCollaborators[] {
    return this.songDataByRelease.get(releaseId) || [];
  }

  toggleEditSongRoyalties(releaseId: number): void {
    if (this.editingSongRoyalties && this.songRoyaltyReleaseId === releaseId) {
      this.editingSongRoyalties = false;
      this.songRoyaltyReleaseId = 0;
      // Reload to discard unsaved changes
      this.songDataByRelease.delete(releaseId);
      this.loadSongCollaboratorRoyalties(releaseId);
    } else {
      this.editingSongRoyalties = true;
      this.songRoyaltyReleaseId = releaseId;
    }
  }

  onSongCollaboratorPercentageChange(collaborator: SongCollaboratorRoyalty, field: string, event: any): void {
    const value = parseFloat(event.target.value) / 100;
    (collaborator as any)[field] = value;
  }

  async saveSongRoyalties(releaseId: number): Promise<void> {
    const songs = this.songDataByRelease.get(releaseId);
    if (!songs) return;

    this.updatingSongRoyalties = true;
    try {
      const updates: any[] = [];
      for (const song of songs) {
        for (const collab of song.collaborators) {
          updates.push({
            song_id: song.song_id,
            artist_id: collab.artist_id,
            streaming_royalty_percentage: collab.streaming_royalty_percentage * 100,
            sync_royalty_percentage: collab.sync_royalty_percentage * 100,
            download_royalty_percentage: collab.download_royalty_percentage * 100,
            physical_royalty_percentage: collab.physical_royalty_percentage * 100
          });
        }
      }

      await this.financialService.updateSongCollaboratorRoyalties(releaseId, updates);
      this.notificationService.showSuccess('Song collaborator royalties updated');
      this.editingSongRoyalties = false;
      this.songRoyaltyReleaseId = 0;
    } catch (error) {
      console.error('Error updating song collaborator royalties:', error);
      this.notificationService.showError('Failed to update song collaborator royalties');
    } finally {
      this.updatingSongRoyalties = false;
    }
  }
}
