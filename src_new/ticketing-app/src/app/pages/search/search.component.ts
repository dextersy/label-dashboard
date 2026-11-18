import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SearchService, SearchResults } from '../../services/search.service';
import { AudienceHeaderComponent } from '../../components/audience-header/audience-header.component';

type SearchTab = 'all' | 'events' | 'organizers' | 'people';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AudienceHeaderComponent],
  template: `
    <app-audience-header></app-audience-header>
    <div class="min-h-screen bg-zinc-950 pt-12">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        <!-- Search input -->
        <div class="relative mb-6">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (keydown.enter)="runSearch()"
            placeholder="Search events, organizers, people..."
            class="w-full bg-white/5 border border-white/15 text-white text-sm font-mono placeholder-white/25 pl-10 pr-4 py-3 focus:outline-none focus:border-white/40 transition-colors"
          >
        </div>

        @if (searchQuery) {
          <!-- Tabs -->
          <div class="flex gap-1 mb-6 border-b border-white/10 pb-0">
            @for (tab of tabs; track tab.key) {
              <button type="button" (click)="activeTab.set(tab.key)"
                class="px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors border-b-2 -mb-px"
                [class.text-yellow-400]="activeTab() === tab.key"
                [class.border-yellow-400]="activeTab() === tab.key"
                [class.text-white/40]="activeTab() !== tab.key"
                [class.border-transparent]="activeTab() !== tab.key">
                {{ tab.label }}
                @if (tab.key !== 'all' && getCount(tab.key) > 0) {
                  <span class="ml-1 opacity-60">({{ getCount(tab.key) }})</span>
                }
              </button>
            }
          </div>

          @if (loading()) {
            <div class="flex items-center justify-center py-20">
              <div class="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            </div>

          } @else if (isEmpty()) {
            <div class="text-center py-20">
              <p class="text-white/30 font-mono text-sm">No results for "{{ searchQuery }}".</p>
            </div>

          } @else {

            <!-- Events -->
            @if ((activeTab() === 'all' || activeTab() === 'events') && results().events.length > 0) {
              <section class="mb-8">
                @if (activeTab() === 'all') {
                  <h2 class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-3">Events</h2>
                }
                <div class="space-y-px">
                  @for (event of results().events; track event.id) {
                    <a [routerLink]="['/events', event.id]"
                      class="flex items-center gap-4 p-3 bg-black/30 hover:bg-white/5 transition-colors">
                      @if (event.poster_url) {
                        <img [src]="event.poster_url" [alt]="event.title" class="w-12 h-12 object-cover flex-shrink-0">
                      } @else {
                        <div class="w-12 h-12 bg-white/5 flex items-center justify-center flex-shrink-0">
                          <svg class="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                        </div>
                      }
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-mono text-white truncate">{{ event.title }}</p>
                        <p class="text-xs font-mono text-white/40 mt-0.5 truncate">{{ formatDate(event.date_and_time) }} · {{ event.venue }}</p>
                        @if (event.brand_name) {
                          <p class="text-[10px] font-mono text-white/25 mt-0.5">by {{ event.brand_name }}</p>
                        }
                      </div>
                    </a>
                  }
                </div>
              </section>
            }

            <!-- Organizers -->
            @if ((activeTab() === 'all' || activeTab() === 'organizers') && results().organizers.length > 0) {
              <section class="mb-8">
                @if (activeTab() === 'all') {
                  <h2 class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-3">Organizers</h2>
                }
                <div class="space-y-px">
                  @for (org of results().organizers; track org.id) {
                    <a [routerLink]="['/organizers', org.id]"
                      class="flex items-center gap-4 p-3 bg-black/30 hover:bg-white/5 transition-colors">
                      @if (org.logo_url) {
                        <img [src]="org.logo_url" [alt]="org.brand_name" class="w-12 h-12 object-contain flex-shrink-0 p-1">
                      } @else {
                        <div class="w-12 h-12 bg-white/5 flex items-center justify-center flex-shrink-0">
                          <span class="text-white/40 text-lg font-black">{{ org.brand_name.charAt(0).toUpperCase() }}</span>
                        </div>
                      }
                      <p class="text-sm font-mono text-white truncate">{{ org.brand_name }}</p>
                    </a>
                  }
                </div>
              </section>
            }

            <!-- People -->
            @if ((activeTab() === 'all' || activeTab() === 'people') && results().people.length > 0) {
              <section class="mb-8">
                @if (activeTab() === 'all') {
                  <h2 class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-3">People</h2>
                }
                <div class="space-y-px">
                  @for (person of results().people; track person.id) {
                    <a [routerLink]="['/people', person.id]"
                      class="flex items-center gap-4 p-3 bg-black/30 hover:bg-white/5 transition-colors">
                      @if (person.profile_photo_url) {
                        <img [src]="person.profile_photo_url" [alt]="person.first_name" class="w-12 h-12 object-cover flex-shrink-0">
                      } @else {
                        <div class="w-12 h-12 bg-white flex items-center justify-center flex-shrink-0">
                          <span class="text-black text-lg font-black">{{ person.first_name.charAt(0).toUpperCase() }}</span>
                        </div>
                      }
                      <div>
                        <p class="text-sm font-mono text-white">{{ person.first_name }} {{ person.last_name }}</p>
                        @if (person.city) {
                          <p class="text-xs font-mono text-white/40 mt-0.5">{{ person.city }}</p>
                        }
                      </div>
                    </a>
                  }
                </div>
              </section>
            }

          }
        }
      </div>
    </div>
  `
})
export class SearchComponent implements OnInit {
  searchQuery = '';
  readonly activeTab = signal<SearchTab>('all');
  readonly loading = signal(false);
  readonly results = signal<SearchResults>({ events: [], organizers: [], people: [], totals: { events: 0, organizers: 0, people: 0 } });

  readonly tabs: { key: SearchTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'events', label: 'Events' },
    { key: 'organizers', label: 'Organizers' },
    { key: 'people', label: 'People' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private searchService: SearchService,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const q = params.get('q') || '';
      const type = (params.get('type') || 'all') as SearchTab;
      this.searchQuery = q;
      this.activeTab.set(type);
      if (q.length >= 2) this.runSearch();
    });
  }

  runSearch(): void {
    if (this.searchQuery.length < 2) return;
    this.router.navigate(['/search'], { queryParams: { q: this.searchQuery, type: this.activeTab() }, replaceUrl: true });
    this.loading.set(true);
    this.searchService.search(this.searchQuery).subscribe({
      next: (r) => { this.results.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  isEmpty(): boolean {
    const r = this.results();
    return r.events.length === 0 && r.organizers.length === 0 && r.people.length === 0;
  }

  getCount(tab: SearchTab): number {
    const t = this.results().totals;
    if (tab === 'events') return t.events;
    if (tab === 'organizers') return t.organizers;
    if (tab === 'people') return t.people;
    return 0;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
