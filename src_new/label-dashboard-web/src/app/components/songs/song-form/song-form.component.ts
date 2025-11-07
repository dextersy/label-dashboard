import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Song, SongCollaborator, SongAuthor, SongComposer, Songwriter } from '../../../services/song.service';
import { ApiService } from '../../../services/api.service';
import { SongwriterService } from '../../../services/songwriter.service';

@Component({
  selector: 'app-song-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './song-form.component.html',
  styleUrl: './song-form.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class SongFormComponent implements OnChanges, OnInit {
  @Input() isVisible: boolean = false;
  @Input() releaseId: number = 0;
  @Input() song: Song | null = null;
  @Input() isSubmitting: boolean = false;
  @Input() isAdmin: boolean = false;
  @Input() releaseStatus: string = 'Draft';
  @Input() releaseArtists: any[] = []; // Artists associated with the release (non-editable collaborators)
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<any>();

  artists: any[] = [];
  releaseArtistIds: number[] = []; // IDs of release artists to filter them out from editable collaborators
  songwriters: Songwriter[] = [];
  filteredAuthorSongwriters: Songwriter[] = [];
  filteredComposerSongwriters: Songwriter[] = [];
  showAuthorDropdown: boolean = false;
  showComposerDropdown: boolean = false;
  isCreatingNewAuthor: boolean = false;
  isCreatingNewComposer: boolean = false;
  showCollaboratorDropdown: boolean = false;
  collaboratorInputFocused: boolean = false;
  authorInputFocused: boolean = false;
  composerInputFocused: boolean = false;
  nextTempSongwriterId: number = -1; // Negative IDs for temporary songwriters

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
    artist_id: 0
  };

  newAuthor = {
    songwriter_id: 0,
    name: '',
    pro_affiliation: 'FILSCAP',
    ipi_number: '',
    share_percentage: undefined as number | undefined
  };

  newComposer = {
    songwriter_id: 0,
    name: '',
    pro_affiliation: 'FILSCAP',
    ipi_number: '',
    share_percentage: undefined as number | undefined
  };

  constructor(
    private apiService: ApiService,
    private songwriterService: SongwriterService
  ) {}

  ngOnInit(): void {
    this.loadArtists();
    this.loadSongwriters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['releaseArtists'] && this.isVisible && this.song) {
      // Reload song data if we're currently editing a song to re-filter collaborators
      this.loadSongData();
    }

    if (changes['isVisible']) {
      if (this.isVisible) {
        document.body.classList.add('modal-open');
        this.resetForm();
        if (this.song) {
          this.loadSongData();
        }
        // Reload songwriters when modal opens to ensure fresh data
        this.loadSongwriters();
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

  loadSongwriters(search?: string): void {
    this.songwriterService.searchSongwriters(search).subscribe({
      next: (response) => {
        this.songwriters = response.songwriters || [];
        this.filteredAuthorSongwriters = this.songwriters;
        this.filteredComposerSongwriters = this.songwriters;
      },
      error: (error) => {
        console.error('Error loading songwriters:', error);
      }
    });
  }

  onAuthorNameChange(): void {
    const search = this.newAuthor.name.toLowerCase();
    const addedIds = this.songForm.authors.map(a => a.songwriter_id);
    this.filteredAuthorSongwriters = this.getFilteredSongwriters(search, addedIds);
    this.showAuthorDropdown = true;
    this.newAuthor.songwriter_id = 0;
  }

  onComposerNameChange(): void {
    const search = this.newComposer.name.toLowerCase();
    const addedIds = this.songForm.composers.map(c => c.songwriter_id);
    this.filteredComposerSongwriters = this.getFilteredSongwriters(search, addedIds);
    this.showComposerDropdown = true;
    this.newComposer.songwriter_id = 0;
  }

  private getFilteredSongwriters(search: string, excludeIds: number[]): Songwriter[] {
    return this.songwriters.filter(s =>
      // Exclude already added songwriters
      !excludeIds.includes(s.id) &&
      // Match search criteria
      (s.name.toLowerCase().includes(search) ||
      (s.pro_affiliation && s.pro_affiliation.toLowerCase().includes(search)) ||
      (s.ipi_number && s.ipi_number.toLowerCase().includes(search)))
    );
  }

  private getOrCreateTempSongwriter(name: string, proAffiliation?: string, ipiNumber?: string): number {
    // Check if a temporary songwriter with the same data already exists
    const normalizedName = name.trim().toLowerCase();
    const existingTemp = this.songwriters.find(s =>
      s.id < 0 &&
      s.name.toLowerCase() === normalizedName &&
      s.pro_affiliation === proAffiliation &&
      s.ipi_number === ipiNumber
    );

    if (existingTemp) {
      // Use the existing temporary songwriter
      return existingTemp.id;
    }

    // Create a new temporary songwriter with negative ID
    const tempSongwriter: Songwriter = {
      id: this.nextTempSongwriterId,
      name: name.trim(),
      pro_affiliation: proAffiliation || undefined,
      ipi_number: ipiNumber || undefined
    };

    // Add to songwriters array so it's available for selection
    this.songwriters.push(tempSongwriter);
    const tempId = this.nextTempSongwriterId;
    this.nextTempSongwriterId--; // Decrement for next temp songwriter

    return tempId;
  }

  selectAuthorSongwriter(songwriter: Songwriter): void {
    this.newAuthor.songwriter_id = songwriter.id;
    this.newAuthor.name = songwriter.name;
    this.newAuthor.pro_affiliation = songwriter.pro_affiliation || '';
    this.newAuthor.ipi_number = songwriter.ipi_number || '';
    this.showAuthorDropdown = false;
    this.isCreatingNewAuthor = false;

    // Auto-add after selection
    this.addAuthor();
  }

  selectComposerSongwriter(songwriter: Songwriter): void {
    this.newComposer.songwriter_id = songwriter.id;
    this.newComposer.name = songwriter.name;
    this.newComposer.pro_affiliation = songwriter.pro_affiliation || '';
    this.newComposer.ipi_number = songwriter.ipi_number || '';
    this.showComposerDropdown = false;
    this.isCreatingNewComposer = false;

    // Auto-add after selection
    this.addComposer();
  }

  onAuthorInputFocus(): void {
    const search = this.newAuthor.name.toLowerCase();
    const addedIds = this.songForm.authors.map(a => a.songwriter_id);
    this.filteredAuthorSongwriters = this.getFilteredSongwriters(search, addedIds);
    this.showAuthorDropdown = true;
  }

  createNewAuthor(): void {
    this.showAuthorDropdown = false;
    this.isCreatingNewAuthor = true;
    this.newAuthor.songwriter_id = 0;
  }

  onComposerInputFocus(): void {
    const search = this.newComposer.name.toLowerCase();
    const addedIds = this.songForm.composers.map(c => c.songwriter_id);
    this.filteredComposerSongwriters = this.getFilteredSongwriters(search, addedIds);
    this.showComposerDropdown = true;
  }

  createNewComposer(): void {
    this.showComposerDropdown = false;
    this.isCreatingNewComposer = true;
    this.newComposer.songwriter_id = 0;
  }

  hideAuthorDropdown(): void {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      this.showAuthorDropdown = false;
    }, 200);
  }

  hideComposerDropdown(): void {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      this.showComposerDropdown = false;
    }, 200);
  }

  loadSongData(): void {
    if (this.song) {
      // Ensure releaseArtistIds is up to date
      // Note: releaseArtists have 'artist_id' property, not 'id'
      this.releaseArtistIds = this.releaseArtists.map(a => Number(a.artist_id));

      // Filter out release artists from editable collaborators
      const editableCollaborators = this.song.collaborators
        ? this.song.collaborators.filter(c => !this.releaseArtistIds.includes(Number(c.artist_id)))
        : [];

      this.songForm = {
        title: this.song.title,
        duration: this.song.duration,
        lyrics: this.song.lyrics || '',
        isrc: this.song.isrc || '',
        spotify_link: this.song.spotify_link || '',
        apple_music_link: this.song.apple_music_link || '',
        youtube_link: this.song.youtube_link || '',
        collaborators: editableCollaborators,
        authors: this.song.authors ? [...this.song.authors] : [],
        composers: this.song.composers ? [...this.song.composers] : []
      };
    }
  }

  onClose(): void {
    this.close.emit();
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid) {
      return;
    }

    // Map to track temporary songwriter IDs to their real backend IDs
    // This ensures the same songwriter is only created once even if used in both authors and composers
    const tempSongwriterMap = new Map<number, number>();

    // Process authors - create new songwriters if needed
    const processedAuthors = await this.processAuthors(tempSongwriterMap);

    // Process composers - create new songwriters if needed (reusing already created songwriters)
    const processedComposers = await this.processComposers(tempSongwriterMap);

    const songData = {
      release_id: this.releaseId,
      ...this.songForm,
      authors: processedAuthors,
      composers: processedComposers
    };

    this.submit.emit(songData);
  }

  private async processAuthors(tempSongwriterMap: Map<number, number>): Promise<any[]> {
    const processed = [];

    for (const author of this.songForm.authors) {
      if (author.songwriter_id > 0) {
        // Existing songwriter from backend
        processed.push({
          songwriter_id: author.songwriter_id,
          share_percentage: author.share_percentage
        });
      } else if (author.songwriter_id < 0) {
        // Temporary songwriter - check if we already created it
        if (tempSongwriterMap.has(author.songwriter_id)) {
          // Already created - use the mapped ID
          processed.push({
            songwriter_id: tempSongwriterMap.get(author.songwriter_id)!,
            share_percentage: author.share_percentage
          });
        } else {
          // Create new songwriter
          try {
            const tempSongwriter = this.songwriters.find(s => s.id === author.songwriter_id);
            if (!tempSongwriter) continue;

            const response = await firstValueFrom(this.songwriterService.createSongwriter({
              name: tempSongwriter.name,
              pro_affiliation: tempSongwriter.pro_affiliation || undefined,
              ipi_number: tempSongwriter.ipi_number || undefined
            }));

            if (response && response.songwriter) {
              // Map temporary ID to real ID
              tempSongwriterMap.set(author.songwriter_id, response.songwriter.id);
              processed.push({
                songwriter_id: response.songwriter.id,
                share_percentage: author.share_percentage
              });
            }
          } catch (error) {
            console.error('Error creating songwriter:', error);
            // Skip this author if creation failed
          }
        }
      }
    }

    return processed;
  }

  private async processComposers(tempSongwriterMap: Map<number, number>): Promise<any[]> {
    const processed = [];

    for (const composer of this.songForm.composers) {
      if (composer.songwriter_id > 0) {
        // Existing songwriter from backend
        processed.push({
          songwriter_id: composer.songwriter_id,
          share_percentage: composer.share_percentage
        });
      } else if (composer.songwriter_id < 0) {
        // Temporary songwriter - check if we already created it
        if (tempSongwriterMap.has(composer.songwriter_id)) {
          // Already created - use the mapped ID
          processed.push({
            songwriter_id: tempSongwriterMap.get(composer.songwriter_id)!,
            share_percentage: composer.share_percentage
          });
        } else {
          // Create new songwriter
          try {
            const tempSongwriter = this.songwriters.find(s => s.id === composer.songwriter_id);
            if (!tempSongwriter) continue;

            const response = await firstValueFrom(this.songwriterService.createSongwriter({
              name: tempSongwriter.name,
              pro_affiliation: tempSongwriter.pro_affiliation || undefined,
              ipi_number: tempSongwriter.ipi_number || undefined
            }));

            if (response && response.songwriter) {
              // Map temporary ID to real ID
              tempSongwriterMap.set(composer.songwriter_id, response.songwriter.id);
              processed.push({
                songwriter_id: response.songwriter.id,
                share_percentage: composer.share_percentage
              });
            }
          } catch (error) {
            console.error('Error creating songwriter:', error);
            // Skip this composer if creation failed
          }
        }
      }
    }

    return processed;
  }

  addCollaborator(): void {
    if (this.newCollaborator.artist_id > 0) {
      this.songForm.collaborators.push({ ...this.newCollaborator });
      this.newCollaborator = { artist_id: 0 };
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

  onCollaboratorInputFocus(): void {
    this.collaboratorInputFocused = true;
    this.showCollaboratorDropdown = true;
  }

  onCollaboratorInputBlur(): void {
    setTimeout(() => {
      this.collaboratorInputFocused = false;
      this.showCollaboratorDropdown = false;
    }, 200);
  }

  selectCollaboratorFromDropdown(artistId: number): void {
    if (!this.releaseArtistIds.includes(artistId) && !this.isArtistAlreadyAdded(artistId)) {
      this.songForm.collaborators.push({ artist_id: artistId });
    }
    this.showCollaboratorDropdown = false;
  }

  onAuthorInputBlur(): void {
    setTimeout(() => {
      this.authorInputFocused = false;
    }, 200);
  }

  onAuthorInputFocusChip(): void {
    this.authorInputFocused = true;
    this.onAuthorInputFocus();
  }

  onComposerInputBlur(): void {
    setTimeout(() => {
      this.composerInputFocused = false;
    }, 200);
  }

  onComposerInputFocusChip(): void {
    this.composerInputFocused = true;
    this.onComposerInputFocus();
  }

  addAuthor(): void {
    if (this.newAuthor.name.trim()) {
      // Get or create temporary songwriter if needed
      if (this.newAuthor.songwriter_id === 0) {
        this.newAuthor.songwriter_id = this.getOrCreateTempSongwriter(
          this.newAuthor.name,
          this.newAuthor.pro_affiliation,
          this.newAuthor.ipi_number
        );
      }

      // Store the author info
      this.songForm.authors.push({ ...this.newAuthor });
      this.newAuthor = {
        songwriter_id: 0,
        name: '',
        pro_affiliation: 'FILSCAP',
        ipi_number: '',
        share_percentage: undefined
      };
      this.showAuthorDropdown = false;
      this.isCreatingNewAuthor = false;
    }
  }

  cancelNewAuthor(): void {
    this.isCreatingNewAuthor = false;
    this.newAuthor = {
      songwriter_id: 0,
      name: '',
      pro_affiliation: 'FILSCAP',
      ipi_number: '',
      share_percentage: undefined
    };
  }

  removeAuthor(index: number): void {
    this.songForm.authors.splice(index, 1);
  }

  onAuthorEnterKey(event: any): void {
    if (this.showAuthorDropdown && this.filteredAuthorSongwriters.length > 0) {
      // Select first suggestion
      this.selectAuthorSongwriter(this.filteredAuthorSongwriters[0]);
    } else if (this.newAuthor.name.trim()) {
      // Add as new songwriter
      this.createNewAuthor();
    }
    event.preventDefault();
  }

  addComposer(): void {
    if (this.newComposer.name.trim()) {
      // Get or create temporary songwriter if needed
      if (this.newComposer.songwriter_id === 0) {
        this.newComposer.songwriter_id = this.getOrCreateTempSongwriter(
          this.newComposer.name,
          this.newComposer.pro_affiliation,
          this.newComposer.ipi_number
        );
      }

      // Store the composer info
      this.songForm.composers.push({ ...this.newComposer });
      this.newComposer = {
        songwriter_id: 0,
        name: '',
        pro_affiliation: 'FILSCAP',
        ipi_number: '',
        share_percentage: undefined
      };
      this.showComposerDropdown = false;
      this.isCreatingNewComposer = false;
    }
  }

  cancelNewComposer(): void {
    this.isCreatingNewComposer = false;
    this.newComposer = {
      songwriter_id: 0,
      name: '',
      pro_affiliation: 'FILSCAP',
      ipi_number: '',
      share_percentage: undefined
    };
  }

  removeComposer(index: number): void {
    this.songForm.composers.splice(index, 1);
  }

  onComposerEnterKey(event: any): void {
    if (this.showComposerDropdown && this.filteredComposerSongwriters.length > 0) {
      // Select first suggestion
      this.selectComposerSongwriter(this.filteredComposerSongwriters[0]);
    } else if (this.newComposer.name.trim()) {
      // Add as new songwriter
      this.createNewComposer();
    }
    event.preventDefault();
  }

  getArtistName(artistId: number): string {
    const artist = this.artists.find(a => Number(a.id) === Number(artistId));
    return artist ? artist.name : 'Unknown Artist';
  }

  isArtistAlreadyAdded(artistId: number): boolean {
    return this.songForm.collaborators.some(c => Number(c.artist_id) === Number(artistId));
  }

  getSongwriterDisplay(author: any): string {
    if (author.songwriter_id > 0) {
      const songwriter = this.songwriters.find(s => s.id === author.songwriter_id);
      if (songwriter) {
        let display = songwriter.name;
        if (songwriter.pro_affiliation) {
          display += ` (${songwriter.pro_affiliation})`;
        }
        if (songwriter.ipi_number) {
          display += ` - IPI: ${songwriter.ipi_number}`;
        }
        return display;
      }
    }

    // New songwriter (not yet in database)
    let display = author.name || 'Unknown';
    if (author.pro_affiliation) {
      display += ` (${author.pro_affiliation})`;
    }
    if (author.ipi_number) {
      display += ` - IPI: ${author.ipi_number}`;
    }
    return display;
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
    this.newCollaborator = { artist_id: 0 };
    this.newAuthor = { songwriter_id: 0, name: '', pro_affiliation: 'FILSCAP', ipi_number: '', share_percentage: undefined };
    this.newComposer = { songwriter_id: 0, name: '', pro_affiliation: 'FILSCAP', ipi_number: '', share_percentage: undefined };
    this.showAuthorDropdown = false;
    this.showComposerDropdown = false;
    this.isCreatingNewAuthor = false;
    this.isCreatingNewComposer = false;

    // Remove temporary songwriters (negative IDs) from songwriters array
    this.songwriters = this.songwriters.filter(s => s.id > 0);

    // Reset temporary songwriter counter
    this.nextTempSongwriterId = -1;
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
    // If no status or status is Draft, not restricted
    if (!this.releaseStatus || this.releaseStatus === 'Draft') {
      return false;
    }
    return !this.isAdmin;
  }
}
