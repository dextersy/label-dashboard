import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-terms',
  imports: [RouterLink],
  templateUrl: './terms.component.html',
})
export class TermsComponent implements OnInit {
  lastUpdated = 'August 2026';

  constructor(private titleService: Title, private meta: Meta) {}

  ngOnInit(): void {
    this.titleService.setTitle('Terms of Service | Spindly');
    this.meta.updateTag({ name: 'description', content: 'Spindly Terms of Service — the rules that govern your use of the Spindly label management platform.' });
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }
}
