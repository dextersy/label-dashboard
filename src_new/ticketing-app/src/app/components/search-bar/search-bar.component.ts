import { Component, ElementRef, HostListener, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { SearchService, SearchResults } from '../../services/search.service';

const EMPTY_RESULTS: SearchResults = {
  events: [], organizers: [], people: [],
  totals: { events: 0, organizers: 0, people: 0 },
};

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <!-- ── Mobile overlay (fixed, covers header) ── -->
    @if (mobileOpen()) {
      <div class="sm:hidden fixed top-0 inset-x-0 h-12 bg-black border-b-2 border-white/15 z-[60] flex items-center px-4 gap-3"
           (click)="$event.stopPropagation()">
        <svg class="w-3.5 h-3.5 text-white/25 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
        </svg>
        <input #mobileInput
          type="text"
          [(ngModel)]="query"
          (ngModelChange)="onInput($event)"
          (focus)="focused.set(true)"
          placeholder="Search..."
          class="flex-1 bg-white/10 text-white text-xs font-mono placeholder-white/30 pl-2 pr-2 py-1.5 focus:outline-none focus:bg-white/15 transition-colors"
        >
        <button type="button" (click)="closeMobile()" class="text-white/40 hover:text-white transition-colors flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        @if (focused() && query.length >= 2) {
          <div class="absolute top-full left-0 right-0 bg-black border-t border-white/10 shadow-xl z-50 max-h-[70vh] overflow-y-auto">
            <ng-container *ngTemplateOutlet="dropdownContent; context: { close: closeMobileFn }"></ng-container>
          </div>
        }
      </div>
    }

    <!-- ── Desktop bar ── -->
    <div class="hidden sm:flex flex-1 justify-center min-w-0 relative" (click)="$event.stopPropagation()">
      <div class="relative flex items-center w-full max-w-xs">
        <svg class="absolute left-2 w-3.5 h-3.5 text-white/30 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
        </svg>
        <input
          type="text"
          [(ngModel)]="query"
          (ngModelChange)="onInput($event)"
          (focus)="focused.set(true)"
          placeholder="Search..."
          class="w-full bg-white/10 text-white text-xs font-mono placeholder-white/30 pl-7 pr-6 py-1.5 focus:outline-none focus:bg-white/15 transition-colors"
        >
        @if (query) {
          <button type="button" (click)="clear()" class="absolute right-2 text-white/30 hover:text-white transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        }
      </div>

      @if (focused() && query.length >= 2) {
        <div class="absolute top-full left-0 right-0 mt-1 bg-black border border-white/20 shadow-xl z-50 max-h-96 overflow-y-auto">
          <ng-container *ngTemplateOutlet="dropdownContent; context: { close: closeDesktopFn }"></ng-container>
        </div>
      }
    </div>

    <!-- ── Shared dropdown content ── -->
    <ng-template #dropdownContent let-close="close">
      @if (loading()) {
        <div class="flex items-center justify-center py-6">
          <div class="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      } @else if (isEmpty()) {
        <p class="text-xs font-mono text-white/30 text-center py-6">No results found.</p>
      } @else {

        @if (results().events.length > 0) {
          <div class="border-b border-white/10">
            <div class="px-3 py-2">
              <span class="text-[9px] font-mono text-white/30 uppercase tracking-widest">Events</span>
            </div>
            @for (event of results().events; track event.id) {
              <a [routerLink]="['/events', event.id]" (click)="close()"
                class="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors">
                @if (event.poster_url) {
                  <img [src]="event.poster_url" [alt]="event.title" class="w-8 h-8 object-cover flex-shrink-0">
                } @else {
                  <div class="w-8 h-8 bg-white/10 flex items-center justify-center flex-shrink-0">
                    <svg class="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  </div>
                }
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-mono text-white truncate">{{ event.title }}</p>
                  <p class="text-[10px] font-mono text-white/40 truncate">{{ formatDate(event.date_and_time) }} · {{ event.venue }}</p>
                </div>
              </a>
            }
            @if (results().totals.events > 3) {
              <a [routerLink]="['/search']" [queryParams]="{ q: query, type: 'events' }" (click)="close()"
                class="flex items-center justify-center px-3 py-2 text-[10px] font-mono text-yellow-400/70 hover:text-yellow-400 uppercase tracking-widest transition-colors border-t border-white/5">
                More results ({{ results().totals.events }})
              </a>
            }
          </div>
        }

        @if (results().organizers.length > 0) {
          <div class="border-b border-white/10">
            <div class="px-3 py-2">
              <span class="text-[9px] font-mono text-white/30 uppercase tracking-widest">Organizers</span>
            </div>
            @for (org of results().organizers; track org.id) {
              <a [routerLink]="['/organizers', org.id]" (click)="close()"
                class="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors">
                @if (org.logo_url) {
                  <img [src]="org.logo_url" [alt]="org.brand_name" class="w-8 h-8 object-contain flex-shrink-0">
                } @else {
                  <div class="w-8 h-8 bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span class="text-white/40 text-xs font-black">{{ org.brand_name.charAt(0).toUpperCase() }}</span>
                  </div>
                }
                <p class="text-xs font-mono text-white truncate">{{ org.brand_name }}</p>
              </a>
            }
            @if (results().totals.organizers > 3) {
              <a [routerLink]="['/search']" [queryParams]="{ q: query, type: 'organizers' }" (click)="close()"
                class="flex items-center justify-center px-3 py-2 text-[10px] font-mono text-yellow-400/70 hover:text-yellow-400 uppercase tracking-widest transition-colors border-t border-white/5">
                More results ({{ results().totals.organizers }})
              </a>
            }
          </div>
        }

        @if (results().people.length > 0) {
          <div>
            <div class="px-3 py-2">
              <span class="text-[9px] font-mono text-white/30 uppercase tracking-widest">People</span>
            </div>
            @for (person of results().people; track person.id) {
              <a [routerLink]="['/people', person.id]" (click)="close()"
                class="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors">
                @if (person.profile_photo_url) {
                  <img [src]="person.profile_photo_url" [alt]="person.first_name" class="w-8 h-8 object-cover flex-shrink-0">
                } @else {
                  <div class="w-8 h-8 bg-white flex items-center justify-center flex-shrink-0">
                    <span class="text-black text-xs font-black">{{ person.first_name.charAt(0).toUpperCase() }}</span>
                  </div>
                }
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-mono text-white truncate">{{ person.first_name }} {{ person.last_name }}</p>
                  @if (person.city) {
                    <p class="text-[10px] font-mono text-white/40 truncate">{{ person.city }}</p>
                  }
                </div>
              </a>
            }
            @if (results().totals.people > 3) {
              <a [routerLink]="['/search']" [queryParams]="{ q: query, type: 'people' }" (click)="close()"
                class="flex items-center justify-center px-3 py-2 text-[10px] font-mono text-yellow-400/70 hover:text-yellow-400 uppercase tracking-widest transition-colors border-t border-white/5">
                More results ({{ results().totals.people }})
              </a>
            }
          </div>
        }

      }
    </ng-template>
  `,
})
export class SearchBarComponent {
  query = '';
  readonly focused = signal(false);
  readonly loading = signal(false);
  readonly mobileOpen = signal(false);
  readonly results = signal<SearchResults>(EMPTY_RESULTS);

  @ViewChild('mobileInput') mobileInputRef?: ElementRef<HTMLInputElement>;

  // Bound close callbacks passed into the shared ng-template
  readonly closeDesktopFn = () => this.focused.set(false);
  readonly closeMobileFn = () => this.closeMobile();

  private readonly input$ = new Subject<string>();

  constructor(private searchService: SearchService) {
    this.input$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.length < 2) {
          this.results.set(EMPTY_RESULTS);
          this.loading.set(false);
          return [];
        }
        this.loading.set(true);
        return this.searchService.search(q);
      }),
    ).subscribe({
      next: (r) => { this.results.set(r as SearchResults); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onInput(value: string): void {
    if (value.length >= 2) this.loading.set(true);
    else { this.results.set(EMPTY_RESULTS); this.loading.set(false); }
    this.input$.next(value);
  }

  isEmpty(): boolean {
    const r = this.results();
    return r.events.length === 0 && r.organizers.length === 0 && r.people.length === 0;
  }

  clear(): void {
    this.query = '';
    this.results.set(EMPTY_RESULTS);
  }

  openMobile(): void {
    this.mobileOpen.set(true);
    this.focused.set(true);
    setTimeout(() => this.mobileInputRef?.nativeElement.focus(), 50);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
    this.focused.set(false);
    this.clear();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.focused.set(false);
    if (this.mobileOpen()) this.closeMobile();
  }
}
