import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { FinancialService } from '../../../services/financial.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { BreadcrumbService } from '../../../services/breadcrumb.service';
import { BreadcrumbComponent } from '../../../shared/breadcrumb/breadcrumb.component';

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
    selector: 'app-song-splits-page',
    imports: [CommonModule, FormsModule, RouterModule, BreadcrumbComponent],
    templateUrl: './song-splits-page.component.html',
    styleUrls: ['./song-splits-page.component.scss']
})
export class SongSplitsPageComponent implements OnInit, OnDestroy {
  releaseId: number = 0;
  releaseTitle: string = '';
  songs: SongWithCollaborators[] = [];
  loading: boolean = true;
  isAdmin: boolean = false;
  editing: boolean = false;
  saving: boolean = false;

  private routeSubscription: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private financialService: FinancialService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private breadcrumbService: BreadcrumbService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();

    this.routeSubscription.add(
      this.route.params.subscribe(params => {
        this.releaseId = +params['id'];
        if (this.releaseId) {
          this.loadData();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.routeSubscription.unsubscribe();
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    try {
      const data = await this.financialService.getSongCollaboratorRoyalties(this.releaseId);
      this.songs = data.songs || [];
      this.releaseTitle = data.release_title || 'Release';

      this.breadcrumbService.setBreadcrumbs([
        { label: 'Financial', route: '/financial', icon: 'fas fa-dollar-sign' },
        { label: 'Release Information', route: '/financial/release' },
        { label: this.releaseTitle }
      ]);
    } catch (error) {
      console.error('Error loading song collaborator royalties:', error);
      this.notificationService.showError('Failed to load song splits');
    } finally {
      this.loading = false;
    }
  }

  formatPercentage(value: number): number {
    return Math.round(value * 100);
  }

  onPercentageChange(collaborator: SongCollaboratorRoyalty, field: string, event: any): void {
    const value = parseFloat(event.target.value) / 100;
    (collaborator as any)[field] = value;
  }

  toggleEdit(): void {
    if (this.editing) {
      // Cancel — reload to discard changes
      this.editing = false;
      this.loadData();
    } else {
      this.editing = true;
    }
  }

  async save(): Promise<void> {
    this.saving = true;
    try {
      const updates: any[] = [];
      for (const song of this.songs) {
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

      await this.financialService.updateSongCollaboratorRoyalties(this.releaseId, updates);
      this.notificationService.showSuccess('Song collaborator royalties updated');
      this.editing = false;
    } catch (error) {
      console.error('Error updating song collaborator royalties:', error);
      this.notificationService.showError('Failed to update song collaborator royalties');
    } finally {
      this.saving = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/financial/release']);
  }
}
