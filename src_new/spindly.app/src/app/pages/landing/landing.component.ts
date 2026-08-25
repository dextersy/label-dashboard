import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit {
  constructor(private title: Title, private meta: Meta) {}

  ngOnInit(): void {
    this.title.setTitle('Label Management Platform for Small Indie Labels | Spindly');
    this.meta.updateTag({ name: 'description', content: 'Spindly is a label management platform built for small indie labels in the Philippines. Label solutions for your music business — artist finances, releases, royalties, and payments in one place.' });
    this.meta.updateTag({ property: 'og:title', content: 'Label Management Platform for Small Indie Labels | Spindly' });
    this.meta.updateTag({ property: 'og:description', content: 'Label solutions for your music business. Spindly gives small indie labels in the Philippines transparent artist finances, release tracking, and royalty management — all in one place.' });
    this.meta.updateTag({ property: 'og:url', content: 'https://spindly.app/' });
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
}
