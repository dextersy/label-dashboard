import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnboardingService, OnboardingStep } from '../../services/onboarding.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss'
})
export class OnboardingComponent implements OnInit, OnDestroy {
  showOnboarding = false;
  currentStep: OnboardingStep | null = null;
  currentStepIndex = 0;
  totalSteps = 0;
  highlightStyle: any = {};
  tooltipStyle: any = {};

  private subscriptions = new Subscription();

  constructor(private onboardingService: OnboardingService) {}

  ngOnInit(): void {
    // Subscribe to onboarding visibility
    this.subscriptions.add(
      this.onboardingService.showOnboarding$.subscribe(show => {
        this.showOnboarding = show;
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

    if (this.currentStep) {
      // Use the step's delay if specified, otherwise use default 100ms
      const delay = this.currentStep.delay || 100;
      setTimeout(() => {
        this.updateHighlightPosition();
      }, delay);
    }
  }

  private updateHighlightPosition(): void {
    if (!this.currentStep || !this.currentStep.targetElement) {
      // Center position for steps without target elements
      this.highlightStyle = {};
      this.tooltipStyle = {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
      return;
    }

    const element = document.querySelector(this.currentStep.targetElement) as HTMLElement;
    if (!element) {
      console.warn(`Target element not found: ${this.currentStep.targetElement}`);
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

    // Position tooltip based on step position
    this.tooltipStyle = this.calculateTooltipPosition(rect);
  }

  private calculateTooltipPosition(rect: DOMRect): any {
    const position = this.currentStep?.position || 'bottom';
    const offset = 20;

    switch (position) {
      case 'top':
        return {
          bottom: `${window.innerHeight - rect.top + offset}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'bottom':
        return {
          top: `${rect.bottom + offset}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          right: `${window.innerWidth - rect.left + offset}px`,
          transform: 'translateY(-50%)'
        };
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + offset}px`,
          transform: 'translateY(-50%)'
        };
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
    this.onboardingService.nextStep();
  }

  onPrevious(): void {
    this.onboardingService.previousStep();
  }

  onSkip(): void {
    this.onboardingService.skipOnboarding();
  }

  get canGoPrevious(): boolean {
    return this.currentStepIndex > 0;
  }

  get isLastStep(): boolean {
    return this.currentStepIndex === this.totalSteps - 1;
  }
}
