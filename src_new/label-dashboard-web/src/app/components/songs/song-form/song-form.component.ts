import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Song, SongCollaborator, SongAuthor, SongComposer } from '../../../services/song.service';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-song-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './song-form.component.html',
  styleUrl: './song-form.component.scss'
})
export class SongFormComponent implements OnChanges, OnInit {
  @Input() isVisible: boolean = false;
  @Input() releaseId: number = 0;
  @Input() song: Song | null = null;
  @Input() isSubmitting: boolean = false;
  @Input() isAdmin: boolean = false;
  @Input() releaseStatus: string = 'Draft';
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<any>();

  artists: any[] = [];

  songForm = {
    title: '',
    duration: undefined as number | undefined,
    lyrics: '',
    isrc: '',
    spotify_link: '',
    apple_music_link: '',
    youtube_link: '',
    collaborators: [] as SongCollaborator[],
    authors: [] as SongAuthor[],
    composers: [] as SongComposer[]
  };

  newCollaborator = {
    artist_id: 0,
    role: ''
  };

  newAuthor = {
    name: '',
    pro_affiliation: '',
    ipi_number: '',
    share_percentage: undefined as number | undefined
  };

  newComposer = {
    name: '',
    pro_affiliation: '',
    ipi_number: '',
    share_percentage: undefined as number | undefined
  };

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadArtists();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        document.body.classList.add('modal-open');
        this.resetForm();
        if (this.song) {
          this.loadSongData();
        }
      } else {
        document.body.classList.remove('modal-open');
      }
    }
  }

  loadArtists(): void {
    this.apiService.getArtists().subscribe({
      next: (response: any) => {
        this.artists = response.artists || [];
      },
      error: (error: any) => {
        console.error('Error loading artists:', error);
      }
    });
  }

  loadSongData(): void {
    if (this.song) {
      this.songForm = {
        title: this.song.title,
        duration: this.song.duration,
        lyrics: this.song.lyrics || '',
        isrc: this.song.isrc || '',
        spotify_link: this.song.spotify_link || '',
        apple_music_link: this.song.apple_music_link || '',
        youtube_link: this.song.youtube_link || '',
        collaborators: this.song.collaborators ? [...this.song.collaborators] : [],
        authors: this.song.authors ? [...this.song.authors] : [],
        composers: this.song.composers ? [...this.song.composers] : []
      };
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.isFormValid) {
      return;
    }

    const songData = {
      release_id: this.releaseId,
      ...this.songForm
    };

    this.submit.emit(songData);
  }

  addCollaborator(): void {
    if (this.newCollaborator.artist_id > 0) {
      this.songForm.collaborators.push({ ...this.newCollaborator });
      this.newCollaborator = { artist_id: 0, role: '' };
    }
  }

  removeCollaborator(index: number): void {
    this.songForm.collaborators.splice(index, 1);
  }

  onCollaboratorBlur(): void {
    // Automatically add collaborator when artist is selected
    if (this.newCollaborator.artist_id > 0) {
      this.addCollaborator();
    }
  }

  addAuthor(): void {
    if (this.newAuthor.name.trim()) {
      this.songForm.authors.push({ ...this.newAuthor });
      this.newAuthor = { name: '', pro_affiliation: '', ipi_number: '', share_percentage: undefined };
    }
  }

  removeAuthor(index: number): void {
    this.songForm.authors.splice(index, 1);
  }

  onAuthorNameBlur(): void {
    // Automatically add author when name field loses focus
    if (this.newAuthor.name.trim()) {
      this.addAuthor();
    }
  }

  addComposer(): void {
    if (this.newComposer.name.trim()) {
      this.songForm.composers.push({ ...this.newComposer });
      this.newComposer = { name: '', pro_affiliation: '', ipi_number: '', share_percentage: undefined };
    }
  }

  removeComposer(index: number): void {
    this.songForm.composers.splice(index, 1);
  }

  onComposerNameBlur(): void {
    // Automatically add composer when name field loses focus
    if (this.newComposer.name.trim()) {
      this.addComposer();
    }
  }

  getArtistName(artistId: number): string {
    const artist = this.artists.find(a => a.id === artistId);
    return artist ? artist.name : 'Unknown Artist';
  }

  private resetForm(): void {
    this.songForm = {
      title: '',
      duration: undefined,
      lyrics: '',
      isrc: '',
      spotify_link: '',
      apple_music_link: '',
      youtube_link: '',
      collaborators: [],
      authors: [],
      composers: []
    };
    this.newCollaborator = { artist_id: 0, role: '' };
    this.newAuthor = { name: '', pro_affiliation: '', ipi_number: '', share_percentage: undefined };
    this.newComposer = { name: '', pro_affiliation: '', ipi_number: '', share_percentage: undefined };
  }

  get isFormValid(): boolean {
    return !!this.songForm.title.trim();
  }

  get isEditMode(): boolean {
    return !!this.song;
  }

  // For non-admin users on non-draft releases, only these fields remain editable:
  // - Song form: lyrics
  // All other fields should have [readonly]="isRestrictedMode()" or [disabled]="isRestrictedMode()" applied
  isRestrictedMode(): boolean {
    return !this.isAdmin && this.releaseStatus !== 'Draft';
  }
}
