import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { WorkspaceService, WorkspaceType } from './workspace.service';
import { SidebarService } from './sidebar.service';
import { BrandService } from './brand.service';

export interface OnboardingWizard {
  id: string;
  name: string;
}

export interface OnboardingStep {
  id: string;
  wizardId: string;
  title: string;
  description: string;
  targetElement?: string; // CSS selector for the element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showOnMobile?: boolean; // Whether to show this step on mobile
  showOnDesktop?: boolean; // Whether to show this step on desktop
  workspace?: WorkspaceType; // Which workspace to switch to for this step
  delay?: number; // Delay before showing this step (to allow workspace switch)
  requiresSidebar?: boolean; // Whether this step requires the sidebar to be open/expanded
  expandMenu?: string; // Route of a sidebar menu to expand (e.g., '/campaigns/events')
  navigateTo?: string; // Route to navigate to for this step
  clickElement?: string; // CSS selector of an element to programmatically click when this step becomes active (e.g. to open a dropdown)
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
  private wizards: OnboardingWizard[] = [];
  private isMobile = false;
  private availableWorkspaces: WorkspaceType[] = [];
  private isAdmin = false;

  constructor(
    private router: Router,
    private workspaceService: WorkspaceService,
    private sidebarService: SidebarService,
    private brandService: BrandService
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
  initializeOnboarding(workspaces: WorkspaceType[], isAdmin = false): void {
    // Don't restart if the tour is already running — prevents re-init from auth
    // subscription re-emissions (e.g. token refresh) disrupting an in-progress tour.
    if (this.showOnboardingSubject.value) return;

    this.availableWorkspaces = workspaces;
    this.isAdmin = isAdmin;
    this.setupSteps();

    // Nothing to show — all wizards already completed
    if (this.steps.length === 0) return;

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

  private isWizardComplete(wizardId: string): boolean {
    return localStorage.getItem(`onboarding_wizard_${wizardId}`) === 'true';
  }

  private markWizardComplete(wizardId: string): void {
    localStorage.setItem(`onboarding_wizard_${wizardId}`, 'true');
  }

  /**
   * Setup onboarding steps based on available workspaces
   */
  private setupSteps(): void {
    this.wizards = [];
    this.steps = [];

    // --- Wizard 1: Welcome (+ workspace navigator + admin if available) ---
    const welcomeSteps: OnboardingStep[] = [];
    welcomeSteps.push({
      id: 'welcome',
      wizardId: 'welcome',
      title: 'Welcome to the New Dashboard!',
      description: 'We\'ve redesigned the interface to make it easier to navigate. Let\'s take a quick tour of the new features.',
      position: 'center',
      showOnMobile: true,
      showOnDesktop: true
    });
    if (this.isAdmin) {
      this.buildAdminSteps('welcome').forEach(s => welcomeSteps.push(s));
    }
    // Only show workspace navigator step if user has multiple workspaces
    if (this.availableWorkspaces.length > 1) {
      welcomeSteps.push({
        id: 'workspace-navigator',
        wizardId: 'welcome',
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
    this.wizards.push({ id: 'welcome', name: 'Welcome' });
    this.steps.push(...welcomeSteps);

    // --- Wizard 2: Music ---
    if (this.availableWorkspaces.includes('music')) {
      const bs = this.brandService.getCurrentBrandSettings();
      const hasArtistProfiles = bs?.feature_artist_profiles !== false;
      const hasMusicReleases = bs?.feature_music_releases !== false;
      // Skip music wizard entirely if both sub-features are disabled (nothing meaningful to show)
      if (hasArtistProfiles || hasMusicReleases) {
        this.wizards.push({ id: 'music', name: 'Music' });
        this.steps.push(...this.buildWorkspaceSteps('music'));
      }
    }

    // --- Wizard 3: Campaigns ---
    if (this.availableWorkspaces.includes('campaigns')) {
      this.wizards.push({ id: 'campaigns', name: 'Campaigns' });
      this.steps.push(...this.buildWorkspaceSteps('campaigns'));
    }

    // --- Wizard 4: Labels ---
    if (this.availableWorkspaces.includes('labels')) {
      this.wizards.push({ id: 'labels', name: 'Labels' });
      this.steps.push(...this.buildWorkspaceSteps('labels'));
    }

    // Filter steps based on current device
    this.steps = this.steps.filter(step =>
      this.isMobile ? step.showOnMobile : step.showOnDesktop
    );

    // Remove wizards already completed in a previous session
    const completedIds = new Set(this.wizards.filter(w => this.isWizardComplete(w.id)).map(w => w.id));
    this.wizards = this.wizards.filter(w => !completedIds.has(w.id));
    this.steps = this.steps.filter(s => !completedIds.has(s.wizardId));
  }

  /**
   * Add steps for a specific workspace
   */
  private buildWorkspaceSteps(workspace: WorkspaceType): OnboardingStep[] {
    const wizardId = workspace;
    const steps: OnboardingStep[] = [];

    switch (workspace) {
      case 'music': {
        const bs = this.brandService.getCurrentBrandSettings();
        const hasArtistProfiles = bs?.feature_artist_profiles !== false;
        const hasMusicReleases = bs?.feature_music_releases !== false;

        // Only show workspace intro if user has multiple workspaces
        if (this.availableWorkspaces.length > 1) {
          steps.push({
            id: 'music-workspace',
            wizardId,
            title: 'Music Workspace',
            description: 'The Music workspace is where you manage artists, releases, and royalties.',
            targetElement: this.isMobile ? '.mobile-workspace-btn-music' : '.workspace-tab-music',
            position: this.isMobile ? 'top' : 'bottom',
            workspace: 'music',
            navigateTo: this.workspaceService.getWorkspaceLandingUrl('music'),
            delay: 500,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        if (hasArtistProfiles) {
          steps.push({
            id: 'artist-selection',
            wizardId,
            title: 'Artist Selection',
            description: 'Select an artist from the sidebar to view their profile, releases, and financial information. You can switch between artists at any time.',
            targetElement: '.artist-selection-container',
            position: 'right',
            workspace: 'music',
            navigateTo: this.availableWorkspaces.length === 1
              ? this.workspaceService.getWorkspaceLandingUrl('music')
              : undefined,
            delay: 500,
            requiresSidebar: true,
            showOnMobile: true,
            showOnDesktop: true
          });
          steps.push({
            id: 'music-artist',
            wizardId,
            title: 'Artist',
            description: 'View and manage each artist\'s profile, media gallery, and Electronic Press Kit (EPK) — everything needed to represent them professionally.',
            targetElement: '.nav-menu-artist',
            position: 'right',
            workspace: 'music',
            navigateTo: '/artist/profile',
            delay: 500,
            requiresSidebar: true,
            expandMenu: '/artist',
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        if (hasMusicReleases) {
          steps.push({
            id: 'music-releases',
            wizardId,
            title: 'Music',
            description: 'Browse and manage an artist\'s discography — albums, singles, and EPs — along with their release metadata.',
            targetElement: '.nav-menu-music',
            position: 'right',
            workspace: 'music',
            navigateTo: '/music/releases',
            delay: 500,
            requiresSidebar: true,
            expandMenu: '/music',
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        if (hasMusicReleases) {
          steps.push({
            id: 'music-financial',
            wizardId,
            title: 'Financial',
            description: 'Track earnings, royalties, payouts, and advances for each artist. Full financial transparency in one place.',
            targetElement: '.nav-menu-financial',
            position: 'right',
            workspace: 'music',
            navigateTo: '/financial/summary',
            delay: 500,
            requiresSidebar: true,
            expandMenu: '/financial',
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        if (hasArtistProfiles) {
          steps.push({
            id: 'music-team',
            wizardId,
            title: 'Team',
            description: 'Manage the team members associated with each artist — add collaborators and control their access.',
            targetElement: '.nav-menu-team',
            position: 'right',
            workspace: 'music',
            navigateTo: '/team',
            delay: 500,
            requiresSidebar: true,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        break;
      }

      case 'campaigns': {
        // Only show workspace intro if user has multiple workspaces
        if (this.availableWorkspaces.length > 1) {
          steps.push({
            id: 'campaigns-workspace',
            wizardId,
            title: 'Campaigns Workspace',
            description: 'The Campaigns workspace is where you manage live events, fundraisers, tickets, and donations.',
            targetElement: this.isMobile ? '.mobile-workspace-btn-campaigns' : '.workspace-tab-campaigns',
            position: this.isMobile ? 'top' : 'bottom',
            workspace: 'campaigns',
            navigateTo: this.workspaceService.getWorkspaceLandingUrl('campaigns'),
            delay: 500,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        // Events menu step
        steps.push({
          id: 'events-menu',
          wizardId,
          title: 'Events Menu',
          description: 'The Events menu lets you manage your live events, ticket sales, and attendee information.',
          targetElement: '.nav-menu-events',
          position: 'right',
          workspace: 'campaigns',
          delay: 500,
          requiresSidebar: true,
          expandMenu: '/campaigns/events',
          showOnMobile: true,
          showOnDesktop: true
        });
        // Event selection step — no targetElement since there may be no events yet
        steps.push({
          id: 'event-selection',
          wizardId,
          title: 'Event Selection',
          description: 'Use the event selector at the top of the Events page to switch between events. Create your first event using the "New Event" button.',
          position: 'center',
          workspace: 'campaigns',
          delay: 500,
          showOnMobile: true,
          showOnDesktop: true
        });
        if (this.isAdmin) {
          // Fundraisers menu step
          steps.push({
            id: 'fundraisers-menu',
            wizardId,
            title: 'Fundraisers Menu',
            description: 'The Fundraisers menu lets you manage your fundraising campaigns and track donations.',
            targetElement: '.nav-menu-fundraisers',
            position: 'right',
            workspace: 'campaigns',
            delay: 500,
            requiresSidebar: true,
            expandMenu: '/campaigns/fundraisers',
            showOnMobile: true,
            showOnDesktop: true
          });
          // Fundraiser selection step — no targetElement since there may be no fundraisers yet
          steps.push({
            id: 'fundraiser-selection',
            wizardId,
            title: 'Fundraiser Selection',
            description: 'Use the fundraiser selector at the top of the Fundraisers page to switch between campaigns. Create your first fundraiser using the "New Fundraiser" button.',
            position: 'center',
            workspace: 'campaigns',
            delay: 500,
            showOnMobile: true,
            showOnDesktop: true
          });
          // Sync licensing step (only when feature is enabled)
          const brandSettings = this.brandService.getCurrentBrandSettings();
          if (brandSettings?.feature_music_workspace !== false) {
            steps.push({
              id: 'sync-licensing',
              wizardId,
              title: 'Sync Licensing',
              description: 'Manage sync licensing opportunities — track pitches, placements, and licensing deals for your artists\' music.',
              targetElement: '.nav-menu-sync-licensing',
              position: 'right',
              workspace: 'campaigns',
              navigateTo: '/campaigns/sync-licensing',
              delay: 500,
              requiresSidebar: true,
              showOnMobile: true,
              showOnDesktop: true
            });
          }
          // Press campaigns step
          steps.push({
            id: 'press-campaigns',
            wizardId,
            title: 'Press Campaigns',
            description: 'Manage press campaigns for your artists — track media coverage, press contacts, and promotional outreach.',
            targetElement: '.nav-menu-press',
            position: 'right',
            workspace: 'campaigns',
            navigateTo: '/campaigns/press',
            delay: 500,
            requiresSidebar: true,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        break;
      }

      case 'labels': {
        const bs = this.brandService.getCurrentBrandSettings();
        const hasMusicWorkspace = bs?.feature_music_workspace !== false;
        const hasDiscography = bs?.feature_music_releases !== false;
        const hasSublabels = bs?.feature_sublabels !== false;

        steps.push({
          id: 'labels-workspace',
          wizardId,
          title: 'Labels Workspace',
          description: 'The Labels workspace gives you an overview of your label\'s roster, financials, and sublabel structure.',
          targetElement: this.isMobile ? '.mobile-workspace-btn-labels' : '.workspace-tab-labels',
          position: this.isMobile ? 'top' : 'bottom',
          workspace: 'labels',
          navigateTo: this.workspaceService.getWorkspaceLandingUrl('labels'),
          delay: 500,
          showOnMobile: true,
          showOnDesktop: true
        });
        if (hasMusicWorkspace) {
          steps.push({
            id: 'labels-dashboard',
            wizardId,
            title: 'Labels Dashboard',
            description: 'Get a high-level overview of all your artists\' activity, earnings, and releases across the label.',
            targetElement: '.nav-menu-dashboard',
            position: 'right',
            workspace: 'labels',
            navigateTo: '/labels/dashboard',
            delay: 500,
            requiresSidebar: true,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        if (hasDiscography) {
          steps.push({
            id: 'labels-discography',
            wizardId,
            title: 'Discography',
            description: 'Browse the full discography across all artists on the label — albums, singles, and EPs in one place.',
            targetElement: '.nav-menu-discography',
            position: 'right',
            workspace: 'labels',
            navigateTo: '/labels/discography',
            delay: 500,
            requiresSidebar: true,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        steps.push({
          id: 'labels-earnings',
          wizardId,
          title: 'Label Financials',
          description: 'View earnings and financial summaries across the entire label — track revenue, royalties, and payouts at a glance.',
          targetElement: '.nav-menu-earnings',
          position: 'right',
          workspace: 'labels',
          navigateTo: '/labels/earnings',
          delay: 500,
          requiresSidebar: true,
          showOnMobile: true,
          showOnDesktop: true
        });
        if (this.isAdmin) {
          steps.push({
            id: 'labels-reports',
            wizardId,
            title: 'Reports',
            description: 'Generate detailed financial reports across your label — music earnings, artist balances, payouts, royalties, and recuperable expenses.',
            targetElement: '.nav-menu-reports',
            position: 'right',
            workspace: 'labels',
            navigateTo: '/labels/reports/music-earnings',
            delay: 500,
            requiresSidebar: true,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        if (hasSublabels) {
          steps.push({
            id: 'labels-sublabels',
            wizardId,
            title: 'Sublabels',
            description: 'Manage sublabels under your main label — configure branding, assign artists, and track finances independently.',
            targetElement: '.nav-menu-sublabels',
            position: 'right',
            workspace: 'labels',
            navigateTo: '/labels/sublabels',
            delay: 500,
            requiresSidebar: true,
            showOnMobile: true,
            showOnDesktop: true
          });
        }
        steps.push({
          id: 'labels-settings',
          wizardId,
          title: 'Label Settings',
          description: 'Configure your label\'s branding, domain, and platform settings.',
          targetElement: '.nav-menu-setup',
          position: 'right',
          workspace: 'labels',
          navigateTo: '/labels/setup',
          delay: 500,
          requiresSidebar: true,
          showOnMobile: true,
          showOnDesktop: true
        });
        break;
      }
    }

    return steps;
  }

  private buildAdminSteps(wizardId: string): OnboardingStep[] {
    return [
      {
        id: 'admin-menu',
        wizardId,
        title: 'Accessing Administration',
        description: 'The Administration workspace is accessed through your user menu in the top-right corner. Click your name to open the menu, then select "Administration".',
        targetElement: '.user-menu',
        clickElement: '.user-menu-trigger',
        position: this.isMobile ? 'bottom' : 'left',
        workspace: 'admin',
        navigateTo: this.workspaceService.getWorkspaceLandingUrl('admin'),
        delay: 500,
        showOnMobile: true,
        showOnDesktop: true
      },
      {
        id: 'admin-workspace',
        wizardId,
        title: 'Admin Workspace',
        description: 'You\'re now in the Admin workspace — your control centre for managing users, integrations, billing, and system tools.',
        position: 'center',
        workspace: 'admin',
        delay: 500,
        showOnMobile: true,
        showOnDesktop: true
      },
      {
        id: 'admin-users',
        wizardId,
        title: 'User Management',
        description: 'Manage artists, team members, and admin accounts. Invite new users and control their access levels from here.',
        targetElement: '.nav-menu-users',
        position: 'right',
        workspace: 'admin',
        navigateTo: '/admin/users',
        delay: 500,
        requiresSidebar: true,
        showOnMobile: true,
        showOnDesktop: true
      },
      {
        id: 'admin-integrations',
        wizardId,
        title: 'Integrations',
        description: 'Connect third-party services and configure platform integrations to extend the dashboard\'s capabilities.',
        targetElement: '.nav-menu-integrations',
        position: 'right',
        workspace: 'admin',
        navigateTo: '/admin/integrations',
        delay: 500,
        requiresSidebar: true,
        showOnMobile: true,
        showOnDesktop: true
      },
      {
        id: 'admin-billing',
        wizardId,
        title: 'Billing',
        description: 'View and manage your subscription plan and billing details.',
        targetElement: '.nav-menu-subscription',
        position: 'right',
        workspace: 'admin',
        navigateTo: '/admin/subscription',
        delay: 500,
        requiresSidebar: true,
        showOnMobile: true,
        showOnDesktop: true
      },
      {
        id: 'admin-tools',
        wizardId,
        title: 'Tools',
        description: 'Access platform utilities — review email logs, run bulk operations, and other administrative tools.',
        targetElement: '.nav-menu-tools',
        position: 'right',
        workspace: 'admin',
        navigateTo: '/admin/tools/email-logs',
        delay: 500,
        requiresSidebar: true,
        showOnMobile: true,
        showOnDesktop: true
      }
    ];
  }

  getSteps(): OnboardingStep[] {
    return this.steps;
  }

  getWizards(): OnboardingWizard[] {
    return this.wizards;
  }

  getCurrentStepIndex(): number {
    return this.currentStepSubject.value;
  }

  getCurrentStep(): OnboardingStep | null {
    return this.steps[this.currentStepSubject.value] || null;
  }

  getCurrentWizard(): OnboardingWizard | null {
    const step = this.getCurrentStep();
    if (!step) return null;
    return this.wizards.find(w => w.id === step.wizardId) || null;
  }

  getWizardStepIndex(): number {
    const step = this.getCurrentStep();
    if (!step) return 0;
    return this.steps.filter(s => s.wizardId === step.wizardId).indexOf(step);
  }

  getWizardTotalSteps(): number {
    const step = this.getCurrentStep();
    if (!step) return 0;
    return this.steps.filter(s => s.wizardId === step.wizardId).length;
  }

  isLastStepOfWizard(): boolean {
    return this.getWizardStepIndex() === this.getWizardTotalSteps() - 1;
  }

  isLastWizard(): boolean {
    const wizard = this.getCurrentWizard();
    if (!wizard) return true;
    return this.wizards[this.wizards.length - 1]?.id === wizard.id;
  }

  nextStep(): void {
    const currentIndex = this.currentStepSubject.value;
    const nextIndex = currentIndex + 1;
    const currentStep = this.steps[currentIndex];

    if (nextIndex < this.steps.length) {
      const nextStep = this.steps[nextIndex];

      // Mark wizard complete when crossing a wizard boundary
      if (currentStep?.wizardId && nextStep.wizardId !== currentStep.wizardId) {
        this.markWizardComplete(currentStep.wizardId);
      }

      // Switch workspace if the next step requires a different workspace
      if (nextStep.workspace) {
        this.workspaceService.setWorkspace(nextStep.workspace);
      }
      // Navigate to a specific route if required
      if (nextStep.navigateTo) {
        this.router.navigate([nextStep.navigateTo]);
      }
      // Open/expand or close sidebar based on step requirements
      if (nextStep.requiresSidebar) {
        this.sidebarService.openSidebar();
      } else if (this.isMobile) {
        // Close sidebar on mobile for steps that don't require it
        this.sidebarService.closeSidebar();
      }
      // Expand a specific menu if required - do this BEFORE updating the step
      // so the submenu animation can complete before the highlight is calculated
      if (nextStep.expandMenu) {
        // Small delay to allow sidebar to open first, then expand menu
        setTimeout(() => {
          this.sidebarService.expandMenu(nextStep.expandMenu!);
        }, 50);
      }

      this.currentStepSubject.next(nextIndex);
    } else {
      this.completeOnboarding();
    }
  }

  previousStep(): void {
    // Find the previous step whose workspace is available, skipping any that are not
    const currentIndex = this.currentStepSubject.value;
    if (currentIndex > 0) {
      const prevStep = this.steps[currentIndex - 1];

      // Switch workspace if the previous step requires a different workspace
      if (prevStep.workspace) {
        this.workspaceService.setWorkspace(prevStep.workspace);
      }
      // Navigate to a specific route if required
      if (prevStep.navigateTo) {
        this.router.navigate([prevStep.navigateTo]);
      }
      // Open/expand or close sidebar based on step requirements
      if (prevStep.requiresSidebar) {
        this.sidebarService.openSidebar();
      } else if (this.isMobile) {
        this.sidebarService.closeSidebar();
      }
      if (prevStep.expandMenu) {
        setTimeout(() => {
          this.sidebarService.expandMenu(prevStep.expandMenu!);
        }, 50);
      }

      this.currentStepSubject.next(currentIndex - 1);
    }
  }

  skipWizard(): void {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      this.completeOnboarding();
      return;
    }

    // Mark this wizard as done regardless of whether there's a next one
    this.markWizardComplete(currentStep.wizardId);

    const currentWizardIndex = this.wizards.findIndex(w => w.id === currentStep.wizardId);
    const nextWizard = this.wizards[currentWizardIndex + 1];

    if (!nextWizard) {
      this.completeOnboarding();
      return;
    }

    const nextIndex = this.steps.findIndex(s => s.wizardId === nextWizard.id);
    if (nextIndex === -1) {
      this.completeOnboarding();
      return;
    }

    const nextStep = this.steps[nextIndex];
    if (nextStep.workspace) {
      this.workspaceService.setWorkspace(nextStep.workspace);
    }
    if (nextStep.navigateTo) {
      this.router.navigate([nextStep.navigateTo]);
    }
    if (nextStep.requiresSidebar) {
      this.sidebarService.openSidebar();
    } else if (this.isMobile) {
      this.sidebarService.closeSidebar();
    }
    if (nextStep.expandMenu) {
      setTimeout(() => {
        this.sidebarService.expandMenu(nextStep.expandMenu!);
      }, 50);
    }

    this.currentStepSubject.next(nextIndex);
  }

  skipOnboarding(): void {
    // X button — mark all remaining wizards as complete so they don't re-appear
    this.wizards.forEach(w => this.markWizardComplete(w.id));
    this.completeOnboarding();
  }

  completeOnboarding(): void {
    // Mark the current wizard as complete (last step of last wizard)
    const currentStep = this.getCurrentStep();
    if (currentStep?.wizardId) {
      this.markWizardComplete(currentStep.wizardId);
    }

    this.showOnboardingSubject.next(false);
    this.currentStepSubject.next(0);

    const landingWorkspace = this.availableWorkspaces[0] ?? 'music';
    this.workspaceService.setWorkspace(landingWorkspace);
    this.router.navigate([this.workspaceService.getWorkspaceLandingUrl(landingWorkspace)]);
  }

  resetOnboarding(): void {
    // Clear all per-wizard flags so the full tour can be replayed
    this.wizards.forEach(w => localStorage.removeItem(`onboarding_wizard_${w.id}`));
    this.currentStepSubject.next(0);
    this.setupSteps();
  }
}
