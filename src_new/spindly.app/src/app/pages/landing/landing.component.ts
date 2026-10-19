import { Component, OnInit, HostListener, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Meta, Title, DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PlanService, Plan } from '../../services/plan.service';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, CommonModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit {
  // Parallax offset for hero background glows (px)
  parallaxOffset = 0;

  // Active nav section for sticky highlight
  activeSection = '';

  // Pricing state
  billingCycle: 'monthly' | 'annual' = 'monthly';
  plans = signal<Plan[]>([]);
  plansLoading = signal(true);

  @HostListener('window:scroll', [])
  onScroll(): void {
    const scrollY = window.scrollY;
    this.parallaxOffset = scrollY * 0.3;

    // Determine active section
    const sections = ['what-we-handle', 'features', 'pricing'];
    let current = '';
    for (const id of sections) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 80) {
        current = id;
      }
    }
    this.activeSection = current;
  }

  ngOnInit(): void {
    this.title.setTitle('Label Management Platform for Small Indie Labels | Spindly');
    this.meta.updateTag({ name: 'description', content: 'Spindly is a label management platform built for small indie labels in the Philippines. Label solutions for your music business — artist finances, releases, royalties, and payments in one place.' });
    this.meta.updateTag({ property: 'og:title', content: 'Label Management Platform for Small Indie Labels | Spindly' });
    this.meta.updateTag({ property: 'og:description', content: 'Label solutions for your music business. Spindly gives small indie labels in the Philippines transparent artist finances, release tracking, and royalty management — all in one place.' });
    this.meta.updateTag({ property: 'og:url', content: 'https://spindly.app/' });

    this.planService.getPublicPlans().subscribe({
      next: ({ plans }) => {
        this.plans.set(plans);
        this.plansLoading.set(false);
      },
      error: () => this.plansLoading.set(false),
    });
  }

  formatLimit(value: number | null, unit = ''): string {
    if (value === null) return unit ? `Unlimited ${unit}` : 'Unlimited';
    return unit ? `${value} ${unit}` : `${value}`;
  }

  planPrice(plan: Plan): number {
    if (this.billingCycle === 'annual' && plan.price_annual > 0) {
      return plan.price_annual / 12;
    }
    return plan.price_monthly;
  }

  isFree(plan: Plan): boolean {
    return plan.price_monthly === 0;
  }

  middleIndex(count: number): number {
    return Math.floor(count / 2);
  }

  scrollTo(id: string, event: Event): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  features = [
    {
      image: 'money.png',
      title: 'Money, sorted.',
      description: "Artists see exactly what they earned — royalties, advances, deductions — broken down clearly. No more quarterly statements that don't add up.",
    },
    {
      image: 'music.png',
      title: 'Releases, tracked.',
      description: "From first demo to streaming everywhere. Cover art, audio files, metadata — one timeline per release, not scattered across Dropbox and email threads.",
    },
    {
      image: 'documents.png',
      title: 'All the rest.',
      description: "Contracts, payment history, events, documents. If it's part of running a label, it lives here. Stop paying for six separate tools.",
    },
  ];

  labelBenefits = [
    'Manage your whole roster from one dashboard',
    'Custom branding per label or imprint',
    'Full payment and royalty history, always accessible',
    'Multi-label support if you run more than one imprint',
  ];

  keyFeatures: { icon: SafeHtml; title: string; description: string }[];

  constructor(
    private title: Title,
    private meta: Meta,
    private planService: PlanService,
    private sanitizer: DomSanitizer,
  ) {
    const s = (svg: string) => this.sanitizer.bypassSecurityTrustHtml(svg);
    this.keyFeatures = [
      {
        icon: s(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`),
        title: 'Artist dashboards',
        description: 'Every artist on your roster gets a personal view of their earnings, releases, and payment history. Full transparency, zero spreadsheets.',
      },
      {
        icon: s(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`),
        title: 'Financial reporting',
        description: 'Detailed breakdowns of royalties, advances, deductions, and payment runs — for every artist, every release, every period.',
      },
      {
        icon: s(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>`),
        title: 'Release management',
        description: 'Track every release from demo to distribution. Cover art, audio files, metadata — one timeline per release, no more scattered threads.',
      },
      {
        icon: s(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>`),
        title: 'Events & ticketing',
        description: 'Create shows, sell tickets, and fold gate revenue directly into your artists\' earnings — all from the same workspace.',
      },
      {
        icon: s(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>`),
        title: 'Press campaigns',
        description: 'Pitch to media, track coverage, and manage your promo calendar — from announcement to wrap-up — without leaving the platform.',
      },
      {
        icon: s(`<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"/></svg>`),
        title: 'Sync licensing',
        description: 'Pitch your catalog to film, TV, and advertising. Track pitches, manage rights, and capture licensing revenue in one place.',
      },
    ];
  }
}
