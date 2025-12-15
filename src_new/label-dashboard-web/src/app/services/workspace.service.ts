import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type WorkspaceType = 'music' | 'events' | 'admin' | 'labels';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  private currentWorkspaceSubject = new BehaviorSubject<WorkspaceType>('music');
  public currentWorkspace$ = this.currentWorkspaceSubject.asObservable();

  constructor() {}

  get currentWorkspace(): WorkspaceType {
    return this.currentWorkspaceSubject.value;
  }

  setWorkspace(workspace: WorkspaceType): void {
    this.currentWorkspaceSubject.next(workspace);
  }

  getWorkspaceLabel(workspace: WorkspaceType): string {
    switch (workspace) {
      case 'music': return 'Music';
      case 'events': return 'Events';
      case 'labels': return 'Labels';
      case 'admin': return 'Administration';
      default: return 'Music';
    }
  }

  getWorkspaceIcon(workspace: WorkspaceType): string {
    switch (workspace) {
      case 'music': return 'fas fa-music';
      case 'events': return 'fas fa-ticket-alt';
      case 'labels': return 'fas fa-tags';
      case 'admin': return 'fas fa-cogs';
      default: return 'fas fa-music';
    }
  }
}
