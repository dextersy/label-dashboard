import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  features = [
    {
      emoji: '💸',
      title: 'Money, sorted.',
      description: "Artists see exactly what they earned — royalties, advances, deductions — broken down clearly. No more quarterly statements that don't add up.",
    },
    {
      emoji: '🎵',
      title: 'Releases, tracked.',
      description: "From first demo to streaming everywhere. Cover art, audio files, metadata — one timeline per release, not scattered across Dropbox and email threads.",
    },
    {
      emoji: '🗂️',
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
}
