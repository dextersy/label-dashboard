import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingService, OnboardingStep, OnboardingWizard } from '../../services/onboarding.service';
import { Subscription } from 'rxjs';
import { IconComponent } from '../shared/icon/icon.component';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent implements OnInit, OnDestroy {
  showOnboarding = false;
  currentStep: OnboardingStep | null = null;
  currentStepIndex = 0;
  totalSteps = 0;
  currentWizard: OnboardingWizard | null = null;
  wizardStepIndex = 0;
  wizardTotalSteps = 0;
  highlightStyle: any = {};
  highlightReady = false; // true only when highlight has a valid measured position
  tooltipStyle: any = {};
  isTransitioning = false;

  private subscriptions = new Subscription();

  constructor(private onboardingService: OnboardingService) {}

  ngOnInit(): void {
    // Subscribe to onboarding visibility
    this.subscriptions.add(
      this.onboardingService.showOnboarding$.subscribe(show => {
        this.showOnboarding = show;
        if (!show) {
          // Reset state immediately so stale highlight/tooltip don't linger
          this.isTransitioning = false;
          this.highlightReady = false;
          this.currentStep = null;
        }
        if (show) {
          this.updateCurrentStep();
        }
      })
    );

    // Subscribe to current step changes
    this.subscriptions.add(
      this.onboardingService.currentStep$.subscribe(() => {
        if (this.showOnboarding) {
          this.updateCurrentStep();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private updateCurrentStep(): void {
    this.currentStep = this.onboardingService.getCurrentStep();
    this.currentStepIndex = this.onboardingService.getCurrentStepIndex();
    this.totalSteps = this.onboardingService.getSteps().length;
    this.currentWizard = this.onboardingService.getCurrentWizard();
    this.wizardStepIndex = this.onboardingService.getWizardStepIndex();
    this.wizardTotalSteps = this.onboardingService.getWizardTotalSteps();

    if (this.currentStep) {
      // Reset highlight while we wait for the new step's element to appear
      this.highlightReady = false;
      // Use the step's delay if specified, otherwise use default 100ms
      const delay = this.currentStep.delay || 100;
      setTimeout(() => {
        // Programmatically open a dropdown or trigger an element if requested
        if (this.currentStep?.clickElement) {
          const el = document.querySelector(this.currentStep.clickElement) as HTMLElement | null;
          el?.click();
          // Re-calculate highlight after the dropdown has rendered (extra tick)
          setTimeout(() => this.updateHighlightPosition(0, false), 100);
        }
        // finalizeTransition=true: isTransitioning will be cleared once a valid position is found
        this.updateHighlightPosition(0, true);
      }, delay);
    }
  }

  private updateHighlightPosition(retryCount = 0, finalizeTransition = false): void {
    const isMobile = window.innerWidth <= 991;
    // On mobile, the welcome intro step is always centered (no highlight)
    const forceCenter = isMobile && this.currentStep?.id === 'welcome';

    if (!this.currentStep || !this.currentStep.targetElement || forceCenter) {
      // Center position for steps without target elements
      this.highlightStyle = {};
      this.highlightReady = false;
      this.tooltipStyle = {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
      if (finalizeTransition && this.isTransitioning) {
        setTimeout(() => { this.isTransitioning = false; }, 50);
      }
      return;
    }

    const element = document.querySelector(this.currentStep.targetElement) as HTMLElement;
    if (!element) {
      // Clear any stale highlight immediately so the previous step's box isn't shown
      this.highlightStyle = {};
      this.highlightReady = false;
      if (retryCount < 10) {
        // Element not in DOM yet (e.g. waiting for *ngIf / data load); retry
        setTimeout(() => this.updateHighlightPosition(retryCount + 1, finalizeTransition), 300);
      } else {
        console.warn(`Target element not found after retries: ${this.currentStep.targetElement}`);
        if (finalizeTransition && this.isTransitioning) {
          setTimeout(() => { this.isTransitioning = false; }, 50);
        }
      }
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 8;

    // Create highlight around target element
    this.highlightStyle = {
      top: `${rect.top - padding}px`,
      left: `${rect.left - padding}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`
    };
    this.highlightReady = true;

    // Position tooltip based on step position
    this.tooltipStyle = this.calculateTooltipPosition(rect);

    if (finalizeTransition && this.isTransitioning) {
      setTimeout(() => { this.isTransitioning = false; }, 50);
    }
  }

  private calculateTooltipPosition(rect: DOMRect): any {
    const position = this.currentStep?.position || 'bottom';
    const offset = 20;
    const padding = 16; // Padding from screen edges
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth <= 991;

    // For mobile, use smart positioning to keep tooltip visible
    if (isMobile) {
      const estimatedTooltipHeight = 200; // Approximate tooltip height
      const spaceBelow = viewportHeight - rect.bottom;

      // If element is in bottom half and there's not enough space below, position above
      if (position === 'top' || spaceBelow < estimatedTooltipHeight + offset) {
        return {
          bottom: `${viewportHeight - rect.top + offset}px`,
          left: `${padding}px`,
          right: `${padding}px`,
          transform: 'none',
          maxWidth: `${viewportWidth - padding * 2}px`
        };
      } else {
        // Position below if there's enough space
        return {
          top: `${rect.bottom + offset}px`,
          left: `${padding}px`,
          right: `${padding}px`,
          transform: 'none',
          maxWidth: `${viewportWidth - padding * 2}px`
        };
      }
    }

    // Desktop positioning with boundary checks
    switch (position) {
      case 'top':
        return {
          bottom: `${viewportHeight - rect.top + offset}px`,
          left: `${Math.max(padding, Math.min(rect.left + rect.width / 2, viewportWidth - padding))}px`,
          transform: 'translateX(-50%)'
        };
      case 'bottom':
        return {
          top: `${rect.bottom + offset}px`,
          left: `${Math.max(padding, Math.min(rect.left + rect.width / 2, viewportWidth - padding))}px`,
          transform: 'translateX(-50%)'
        };
      case 'left': {
        const estimatedHeight = 220;
        const centerY = rect.top + rect.height / 2;
        const rawTop = centerY - estimatedHeight / 2;
        const clampedTop = Math.max(padding, Math.min(rawTop, viewportHeight - estimatedHeight - padding));
        return {
          top: `${clampedTop}px`,
          right: `${viewportWidth - rect.left + offset}px`,
          transform: 'none'
        };
      }
      case 'right': {
        const estimatedHeight = 220;
        const centerY = rect.top + rect.height / 2;
        const rawTop = centerY - estimatedHeight / 2;
        const clampedTop = Math.max(padding, Math.min(rawTop, viewportHeight - estimatedHeight - padding));
        return {
          top: `${clampedTop}px`,
          left: `${rect.right + offset}px`,
          transform: 'none'
        };
      }
      case 'center':
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        };
    }
  }

  onNext(): void {
    this.closePendingDropdown();
    // Start fade-out transition
    this.isTransitioning = true;
    // Wait for fade-out, then change step
    setTimeout(() => {
      this.onboardingService.nextStep();
    }, 200);
  }

  onPrevious(): void {
    this.closePendingDropdown();
    // Start fade-out transition
    this.isTransitioning = true;
    // Wait for fade-out, then change step
    setTimeout(() => {
      this.onboardingService.previousStep();
    }, 200);
  }

  onSkipWizard(): void {
    this.closePendingDropdown();
    // Start fade-out transition
    this.isTransitioning = true;
    // Wait for fade-out, then jump to next wizard
    setTimeout(() => {
      this.onboardingService.skipWizard();
    }, 200);
  }

  onClose(): void {
    this.closePendingDropdown();
    // X button — closes the entire onboarding immediately
    this.onboardingService.skipOnboarding();
  }

  /**
   * If the current step opened a dropdown via clickElement, close it again
   * before navigating away so the UI is left in a clean state.
   */
  private closePendingDropdown(): void {
    if (this.currentStep?.clickElement) {
      const el = document.querySelector(this.currentStep.clickElement) as HTMLElement | null;
      // Only re-click if the dropdown is currently open (parent has .open class)
      if (el?.closest('.open') || el?.parentElement?.classList.contains('open')) {
        el?.click();
      }
    }
  }

  get skipWizardLabel(): string {
    if (!this.currentWizard) return 'Skip';
    return `Skip ${this.currentWizard.name} tour`;
  }

  get canGoPrevious(): boolean {
    return this.currentStepIndex > 0;
  }

  get isLastStep(): boolean {
    return this.onboardingService.isLastStepOfWizard() && this.onboardingService.isLastWizard();
  }
}
