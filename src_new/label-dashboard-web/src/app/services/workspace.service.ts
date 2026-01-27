import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type WorkspaceType = 'music' | 'campaigns' | 'labels' | 'admin';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  private readonly STORAGE_KEY = 'selectedWorkspace';
  private currentWorkspaceSubject = new BehaviorSubject<WorkspaceType>(this.loadWorkspaceFromStorage());
  public currentWorkspace$ = this.currentWorkspaceSubject.asObservable();

  constructor() {}

  get currentWorkspace(): WorkspaceType {
    return this.currentWorkspaceSubject.value;
  }

  setWorkspace(workspace: WorkspaceType): void {
    this.currentWorkspaceSubject.next(workspace);
    this.saveWorkspaceToStorage(workspace);
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

  getWorkspaceLabel(workspace: WorkspaceType): string {
    switch (workspace) {
      case 'music': return 'Music';
      case 'campaigns': return 'Campaigns';
      case 'labels': return 'Labels';
      case 'admin': return 'Administration';
      default: return 'Music';
    }
  }

  getWorkspaceIcon(workspace: WorkspaceType): string {
    switch (workspace) {
      case 'music': return 'fas fa-music';
      case 'campaigns': return 'fas fa-bullhorn';
      case 'labels': return 'fas fa-tags';
      case 'admin': return 'fas fa-cogs';
      default: return 'fas fa-music';
    }
  }

  /**
   * Get available workspaces based on user permissions
   */
  getAvailableWorkspaces(isAdmin: boolean = false): WorkspaceType[] {
    // Returns workspaces for the toolbar (admin is accessed via upper right menu)
    const workspaces: WorkspaceType[] = ['music'];

    if (isAdmin) {
      workspaces.push('campaigns', 'labels');
    }

    return workspaces;
  }
}
