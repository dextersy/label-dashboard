import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WorkspaceService, WorkspaceType } from './workspace.service';
import { AuthService } from './auth.service';
import { SidebarService } from './sidebar.service';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string; // CSS selector for the element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showOnMobile?: boolean; // Whether to show this step on mobile
  showOnDesktop?: boolean; // Whether to show this step on desktop
  workspace?: WorkspaceType; // Which workspace to switch to for this step
  delay?: number; // Delay before showing this step (to allow workspace switch)
  requiresSidebar?: boolean; // Whether this step requires the sidebar to be open/expanded
}

@Injectable({
  providedIn: 'root'
})
export class OnboardingService {
  private showOnboardingSubject = new BehaviorSubject<boolean>(false);
  private currentStepSubject = new BehaviorSubject<number>(0);

  public showOnboarding$ = this.showOnboardingSubject.asObservable();
  public currentStep$ = this.currentStepSubject.asObservable();

  private steps: OnboardingStep[] = [];
  private isMobile = false;
  private availableWorkspaces: WorkspaceType[] = [];

  constructor(
    private http: HttpClient,
    private workspaceService: WorkspaceService,
    private authService: AuthService,
    private sidebarService: SidebarService
  ) {
    this.checkMobileView();
    window.addEventListener('resize', () => this.checkMobileView());
  }

  private checkMobileView(): void {
    this.isMobile = typeof window !== 'undefined' && window.innerWidth <= 991;
  }

  /**
   * Initialize onboarding for a user
   */
  initializeOnboarding(userOnboardingCompleted: boolean, workspaces: WorkspaceType[]): void {
    if (!userOnboardingCompleted) {
      this.availableWorkspaces = workspaces;
      this.setupSteps();

      // Open/expand sidebar if the first step requires it
      const firstStep = this.steps[0];
      if (firstStep?.requiresSidebar) {
        this.sidebarService.openSidebar();
      }

      // Small delay to ensure DOM is ready
      setTimeout(() => {
        this.showOnboardingSubject.next(true);
      }, 1000);
    }
  }

  /**
   * Setup onboarding steps based on available workspaces
   */
  private setupSteps(): void {
    this.steps = [
      {
        id: 'welcome',
        title: 'Welcome to the New Dashboard!',
        description: 'We\'ve redesigned the interface to make it easier to navigate. Let\'s take a quick tour of the new features.',
        position: 'center',
        showOnMobile: true,
        showOnDesktop: true
      }
    ];

    // Only show workspace navigator step if user has multiple workspaces
    if (this.availableWorkspaces.length > 1) {
      this.steps.push({
        id: 'workspace-navigator',
        title: 'Workspace Navigator',
        description: this.isMobile
          ? 'The bottom navigation bar lets you switch between different workspaces. Each workspace has its own tools and features.'
          : 'The workspace tabs at the top let you switch between different areas. Each workspace has its own tools and features.',
        targetElement: this.isMobile ? '.mobile-bottom-nav' : '.navbar-workspace-selector',
        position: this.isMobile ? 'top' : 'bottom',
        showOnMobile: true,
        showOnDesktop: true
      });
    }

    // Add workspace-specific steps for each available workspace
    this.availableWorkspaces.forEach(workspace => {
      this.addWorkspaceSteps(workspace);
    });

    // Filter steps based on current device
    this.steps = this.steps.filter(step =>
      this.isMobile ? step.showOnMobile : step.showOnDesktop
    );
  }

  /**
   * Add steps for a specific workspace
   */
  private addWorkspaceSteps(workspace: WorkspaceType): void {
    switch (workspace) {
      case 'music':
        // Only show workspace intro if user has multiple workspaces
        if (this.availableWorkspaces.length > 1) {
          this.steps.push({
            id: 'music-workspace',
            title: 'Music Workspace',
            description: 'The Music workspace is where you manage artists, releases, and royalties.',
            targetElement: this.isMobile ? '.mobile-workspace-btn-music' : '.workspace-tab-music',
            position: this.isMobile ? 'top' : 'bottom',
            workspace: 'music',
            delay: 500,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        this.steps.push({
          id: 'artist-selection',
          title: 'Artist Selection',
          description: 'Select an artist from the sidebar to view their profile, releases, and financial information. You can switch between artists at any time.',
          targetElement: '.artist-selection-container',
          position: 'right',
          workspace: 'music',
          delay: 500,
          showOnMobile: true,
          showOnDesktop: true,
          requiresSidebar: true
        });
        break;

      case 'campaigns':
        this.steps.push({
          id: 'campaigns-workspace',
          title: 'Campaigns Workspace',
          description: 'The Campaigns workspace is where you manage live events, fundraisers, tickets, and donations.',
          targetElement: this.isMobile ? '.mobile-workspace-btn-campaigns' : '.workspace-tab-campaigns',
          position: this.isMobile ? 'top' : 'bottom',
          workspace: 'campaigns',
          delay: 500,
          showOnMobile: true,
          showOnDesktop: true
        });
        break;

      case 'admin':
        this.steps.push({
          id: 'admin-workspace',
          title: 'Admin Workspace',
          description: 'The Admin workspace is your control center. Here you can configure settings, view reports, manage users, and access administrative tools from the sidebar menu.',
          targetElement: this.isMobile ? '.mobile-icon-link-admin' : '.nav-link-admin',
          position: this.isMobile ? 'bottom' : 'bottom',
          workspace: 'admin',
          delay: 500,
          showOnMobile: true,
          showOnDesktop: true
        });
        break;
    }
  }

  /**
   * Get all onboarding steps
   */
  getSteps(): OnboardingStep[] {
    return this.steps;
  }

  /**
   * Get current step index
   */
  getCurrentStepIndex(): number {
    return this.currentStepSubject.value;
  }

  /**
   * Get current step
   */
  getCurrentStep(): OnboardingStep | null {
    return this.steps[this.currentStepSubject.value] || null;
  }

  /**
   * Go to next step
   */
  nextStep(): void {
    const currentIndex = this.currentStepSubject.value;
    if (currentIndex < this.steps.length - 1) {
      const nextStep = this.steps[currentIndex + 1];

      // Switch workspace if the next step requires a different workspace
      if (nextStep.workspace) {
        this.workspaceService.setWorkspace(nextStep.workspace);
      }

      // Open/expand or close sidebar based on step requirements
      if (nextStep.requiresSidebar) {
        this.sidebarService.openSidebar();
      } else if (this.isMobile) {
        // Close sidebar on mobile for steps that don't require it
        this.sidebarService.closeSidebar();
      }

      this.currentStepSubject.next(currentIndex + 1);
    } else {
      this.completeOnboarding();
    }
  }

  /**
   * Go to previous step
   */
  previousStep(): void {
    const currentIndex = this.currentStepSubject.value;
    if (currentIndex > 0) {
      this.currentStepSubject.next(currentIndex - 1);
    }
  }

  /**
   * Skip onboarding
   */
  skipOnboarding(): void {
    this.completeOnboarding();
  }

  /**
   * Complete onboarding and call API
   */
  completeOnboarding(): void {
    this.showOnboardingSubject.next(false);
    this.currentStepSubject.next(0);

    // Call API to mark onboarding as completed
    this.http.post(`${environment.apiUrl}/users/complete-onboarding`, {})
      .subscribe({
        next: () => {
          // Update user state in auth service and localStorage
          this.authService.updateCurrentUser({ onboarding_completed: true });
        },
        error: (error) => {
          console.error('Error completing onboarding:', error);
        }
      });
  }

  /**
   * Reset onboarding (for testing)
   */
  resetOnboarding(): void {
    this.currentStepSubject.next(0);
    this.setupSteps();
  }
}
