import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArtistSelectionComponent, Artist } from '../../components/artist/artist-selection/artist-selection.component';
import { ArtistAlertMessageComponent, AlertMessage } from '../../components/artist/artist-alert-message/artist-alert-message.component';
import { ArtistProfileTabComponent, ArtistProfile } from '../../components/artist/artist-profile-tab/artist-profile-tab.component';
import { ArtistGalleryTabComponent } from '../../components/artist/artist-gallery-tab/artist-gallery-tab.component';
import { ArtistReleasesTabComponent, ArtistRelease } from '../../components/artist/artist-releases-tab/artist-releases-tab.component';
import { ArtistTeamTabComponent } from '../../components/artist/artist-team-tab/artist-team-tab.component';

export type TabType = 'profile' | 'gallery' | 'releases' | 'team' | 'new-release' | 'submit-release';

@Component({
  selector: 'app-artist',
  standalone: true,
  imports: [
    CommonModule,
    ArtistSelectionComponent,
    ArtistAlertMessageComponent,
    ArtistProfileTabComponent,
    ArtistGalleryTabComponent,
    ArtistReleasesTabComponent,
    ArtistTeamTabComponent
  ],
  templateUrl: './artist.component.html',
  styleUrl: './artist.component.scss'
})
export class ArtistComponent implements OnInit {
  selectedArtist: Artist | null = null;
  currentAlert: AlertMessage | null = null;
  activeTab: TabType = 'profile';
  isAdmin = false;

  tabs = [
    { id: 'profile' as TabType, label: 'Profile', icon: 'fa-user' },
    { id: 'gallery' as TabType, label: 'Media', icon: 'fa-camera' },
    { id: 'releases' as TabType, label: 'Releases', icon: 'fa-music' },
    { id: 'team' as TabType, label: 'Team', icon: 'fa-users' },
    { id: 'new-release' as TabType, label: 'New Release', icon: 'fa-plus', adminOnly: true },
    { id: 'submit-release' as TabType, label: 'Submit A Release', icon: 'fa-upload' }
  ];

  ngOnInit(): void {
    // Check if user is admin (this would typically come from auth service)
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.isAdmin = user.isAdmin || false;
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }

  onArtistSelected(artist: Artist): void {
    this.selectedArtist = artist;
    // Reset to profile tab when artist changes
    this.activeTab = 'profile';
  }

  onAlertMessage(alert: AlertMessage): void {
    this.currentAlert = alert;
  }

  onArtistUpdated(artist: ArtistProfile): void {
    if (this.selectedArtist) {
      // Update the selected artist with new profile data
      this.selectedArtist = { ...this.selectedArtist, ...artist };
    }
  }

  onEditRelease(release: ArtistRelease): void {
    // TODO: Implement release editing functionality
    // This would typically navigate to a release editing form
    console.log('Edit release:', release);
    this.activeTab = 'new-release';
  }

  setActiveTab(tab: TabType): void {
    this.activeTab = tab;
  }

  shouldShowTab(tab: any): boolean {
    if (tab.adminOnly && !this.isAdmin) {
      return false;
    }
    return true;
  }

  getTabClass(tabId: TabType): string {
    return this.activeTab === tabId ? 'active' : '';
  }
}
