import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-domain-not-found',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './domain-not-found.component.html',
  styleUrl: './domain-not-found.component.scss'
})
export class DomainNotFoundComponent {
  currentDomain: string = '';

  constructor(private router: Router) {
    this.currentDomain = window.location.hostname;
  }

  goToDefaultDomain(): void {
    // You can configure a default domain or redirect to a main site
    window.location.href = 'https://main-domain.com'; // Replace with actual default domain
  }
}