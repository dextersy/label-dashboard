import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { BreadcrumbService, BreadcrumbItem } from '../../services/breadcrumb.service';
import { WorkspaceService, WorkspaceType } from '../../services/workspace.service';

// Routes that are the "root" of each workspace and should not be duplicated
// after the workspace label is already shown as the first breadcrumb.
const WORKSPACE_ROOT_ROUTES: Record<WorkspaceType, string[]> = {
  music:     ['/music'],
  campaigns: ['/campaigns'],
  labels:    ['/labels'],
  admin:     ['/admin'],
};

@Component({
    selector: 'app-breadcrumb',
    imports: [CommonModule, RouterModule],
    templateUrl: './breadcrumb.component.html',
    styleUrl: './breadcrumb.component.scss'
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  breadcrumbs: BreadcrumbItem[] = [];
  workspaceLabel: string = '';
  workspaceIcon: string = '';
  private currentWorkspace: WorkspaceType = 'music';
  private subscription: Subscription = new Subscription();

  constructor(
    private breadcrumbService: BreadcrumbService,
    private workspaceService: WorkspaceService
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.breadcrumbService.breadcrumbs$.subscribe(breadcrumbs => {
        this.breadcrumbs = breadcrumbs;
      })
    );
    this.subscription.add(
      this.workspaceService.currentWorkspace$.subscribe(workspace => {
        this.currentWorkspace = workspace;
        this.workspaceLabel = this.workspaceService.getWorkspaceLabel(workspace);
        this.workspaceIcon  = this.workspaceService.getWorkspaceIcon(workspace);
      })
    );
  }

  // Strip leading breadcrumb items whose route is the workspace's own root
  // (e.g. "Campaigns" when workspace = campaigns) to avoid duplication.
  get filteredBreadcrumbs(): BreadcrumbItem[] {
    const roots = WORKSPACE_ROOT_ROUTES[this.currentWorkspace] ?? [];
    let start = 0;
    while (start < this.breadcrumbs.length && roots.includes(this.breadcrumbs[start].route ?? '')) {
      start++;
    }
    return this.breadcrumbs.slice(start);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}