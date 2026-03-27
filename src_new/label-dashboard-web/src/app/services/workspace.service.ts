import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { BrandService } from './brand.service';

export type WorkspaceType = 'music' | 'campaigns' | 'labels' | 'admin';

export interface WorkspaceInfo {
  type: WorkspaceType;
  label: string;
  icon: string;
  description: string;
}

const WORKSPACE_CONFIG: Record<WorkspaceType, Omit<WorkspaceInfo, 'type'>> = {
  music:     { label: 'Music',          icon: 'fas fa-music',              description: 'Artist information, music releases, and financial' },
  campaigns: { label: 'Campaigns',      icon: 'fas fa-bullhorn',            description: 'Event tickets and fundraisers' },
  labels:    { label: 'Labels',         icon: 'fas fa-tags',                description: 'Label and sublabel information' },
  admin:     { label: 'Administration', icon: 'fas fa-cogs',                description: 'System settings and administration' },
};

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  private readonly STORAGE_KEY = 'selectedWorkspace';
  private currentWorkspaceSubject = new BehaviorSubject<WorkspaceType>(this.loadWorkspaceFromStorage());
  public currentWorkspace$ = this.currentWorkspaceSubject.asObservable();

  constructor(private brandService: BrandService) {}

  get currentWorkspace(): WorkspaceType {
    return this.currentWorkspaceSubject.value;
  }

  setWorkspace(workspace: WorkspaceType): void {
    this.currentWorkspaceSubject.next(workspace);
    this.saveWorkspaceToStorage(workspace);
  }

  getWorkspaceInfo(workspace: WorkspaceType): WorkspaceInfo {
    return { type: workspace, ...WORKSPACE_CONFIG[workspace] };
  }

  getWorkspaceLabel(workspace: WorkspaceType): string {
    return WORKSPACE_CONFIG[workspace].label;
  }

  getWorkspaceIcon(workspace: WorkspaceType): string {
    return WORKSPACE_CONFIG[workspace].icon;
  }

  /**
   * Get available workspaces based on user permissions and brand feature flags
   */
  getAvailableWorkspaces(isAdmin: boolean = false): WorkspaceType[] {
    // Returns workspaces for the toolbar (admin is accessed via upper right menu)
    const settings = this.brandService.getCurrentBrandSettings();
    const workspaces: WorkspaceType[] = [];

    if (settings?.feature_music_workspace !== false) {
      workspaces.push('music');
    }

    if (isAdmin) {
      if (settings?.feature_campaigns_workspace !== false) {
        workspaces.push('campaigns');
      }
      workspaces.push('labels');
    }

    return workspaces;
  }

  getAvailableWorkspaceInfos(isAdmin: boolean = false): WorkspaceInfo[] {
    return this.getAvailableWorkspaces(isAdmin).map(ws => this.getWorkspaceInfo(ws));
  }

  private loadWorkspaceFromStorage(): WorkspaceType {
    const stored = localStorage.getItem(this.STORAGE_KEY);

    // Migration: handle old workspace values
    if (stored === 'events') {
      this.saveWorkspaceToStorage('campaigns');
      return 'campaigns';
    }

    if (stored && this.isValidWorkspace(stored)) {
      return stored as WorkspaceType;
    }
    return 'music'; // Default workspace
  }

  private saveWorkspaceToStorage(workspace: WorkspaceType): void {
    localStorage.setItem(this.STORAGE_KEY, workspace);
  }

  private isValidWorkspace(value: string): boolean {
    return ['music', 'campaigns', 'labels', 'admin'].includes(value);
  }
}
