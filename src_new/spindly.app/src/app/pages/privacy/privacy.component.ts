import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent implements OnInit {
  lastUpdated = 'August 2026';

  constructor(private titleService: Title, private meta: Meta) {}

  ngOnInit(): void {
    this.titleService.setTitle('Privacy Policy | Spindly');
    this.meta.updateTag({ name: 'description', content: 'Spindly Privacy Policy — how we collect, use, and protect your personal data.' });
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}
