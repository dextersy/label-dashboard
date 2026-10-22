import { Component, OnInit, signal, computed, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Title, Meta } from '@angular/platform-browser';
import { environment } from '../../../../environments/environment';
import { ShareModalComponent } from '../../../components/share-modal/share-modal.component';
import { AudienceAuthService } from '../../../services/audience-auth.service';
import { AudienceAuthModalComponent } from '../../../components/audience-auth-modal/audience-auth-modal.component';
import { AudienceSocialService } from '../../../services/audience-social.service';
import { ConnectButtonComponent } from '../../../components/connect-button/connect-button.component';
import { AudienceAttendee, ConnectionMeta } from '../../../models/audience-connection';
import { AudienceHeaderComponent } from '../../../components/audience-header/audience-header.component';

interface PublicEventView {
  id: number;
  title: string;
  description?: string;
  date_and_time: string;
  close_time?: string;
  venue?: string;
  poster_url?: string;
  ticket_price: number;
  ticket_price_display: string;
  ticket_naming?: string;
  buy_shortlink?: string;
  is_closed: boolean;
  tickets_sold?: number;
  venue_address?: string;
  venue_maps_url?: string;
  venue_phone?: string;
  venue_website?: string;
  ticketTypes?: {
    id: number;
    name: string;
    price: number;
    is_available: boolean;
    is_sold_out: boolean;
    remaining_tickets: number | null;
    special_instructions?: string;
  }[];
  brand?: {
    id: number;
    name: string;
    color?: string;
    logo_url?: string;
  } | null;
  event_type?: string | null;
  tags?: { id: number; name: string }[];
  ticketing_enabled?: boolean;
  listed_on_ticketing?: boolean;
  external_ticket_link?: string | null;
  like_count?: number;
  user_liked?: boolean;
  member_discount_type?: 'fixed' | 'percent' | null;
  member_discount_amount?: number | null;
  co_organizers?: { id: number; name: string; logo_url?: string | null }[];
}

@Component({
  selector: 'app-event-view',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, RouterLink, DatePipe, ShareModalComponent, AudienceAuthModalComponent, ConnectButtonComponent, AudienceHeaderComponent],
  styles: [`
    .prose-event h2 { font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.9); margin: 0.75rem 0 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .prose-event h3 { font-size: 0.875rem; font-weight: 700; color: rgba(255,255,255,0.8); margin: 0.5rem 0 0.25rem; }
    .prose-event p { margin: 0 0 0.5rem; }
    .prose-event p:last-child { margin-bottom: 0; }
    .prose-event ul, .prose-event ol { margin: 0.25rem 0 0.5rem 1.25rem; }
    .prose-event li { margin: 0.15rem 0; }
    .prose-event ul { list-style-type: disc; }
    .prose-event ol { list-style-type: decimal; }
    .prose-event a { color: #facc15; text-decoration: underline; }
    .prose-event a:hover { color: #fde047; }
    .prose-event strong { color: rgba(255,255,255,0.9); }
  `],
  template: `
    <!-- Nav -->
    <app-audience-header></app-audience-header>

    <main class="bg-black min-h-screen pt-12">
      @if (loading()) {
        <div class="flex items-center justify-center py-40">
          <p class="text-sm font-mono text-white/30 uppercase tracking-widest animate-pulse">loading...</p>
        </div>
      } @else if (error()) {
        <div class="max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <p class="text-white/30 font-mono text-sm mb-4 uppercase tracking-widest">event not found</p>
          <a href="/#shows" class="text-xs font-bold text-yellow-400 hover:text-yellow-300 uppercase tracking-wider transition-colors">← back to shows</a>
        </div>
      } @else if (event()) {
        <!-- Hero: poster + core info -->
        <section class="relative">
          @if (event()!.poster_url) {
            <!-- Blurred bg poster -->
            <div class="absolute inset-0 overflow-hidden">
              <img [src]="event()!.poster_url" alt="" class="w-full h-full object-cover opacity-15 blur-2xl scale-110">
              <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black"></div>
            </div>
          }
          <div class="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-14 pb-10">
            <div class="flex flex-col md:flex-row gap-8 items-start">
              <!-- Poster -->
              <div class="flex-shrink-0 w-full md:w-64">
                @if (event()!.poster_url) {
                  <img [src]="event()!.poster_url" [alt]="event()!.title"
                    class="w-full md:w-64 aspect-[3/4] object-cover border-2 border-white/10 shadow-2xl">
                } @else {
                  <div class="w-full md:w-64 aspect-[3/4] bg-zinc-950 border-2 border-white/10 flex items-center justify-center"
                    style="background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 1px, transparent 0, transparent 50%); background-size: 8px 8px;">
                    <span class="text-white/10 font-black text-5xl uppercase tracking-widest">GIG</span>
                  </div>
                }
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0 py-2">
                @if (event()!.brand) {
                  <p class="text-xs font-mono text-yellow-400/70 uppercase tracking-[0.2em] mb-3">
                    <a [routerLink]="['/organizers', event()!.brand!.id]" class="hover:text-yellow-400 transition-colors">{{ event()!.brand!.name }}</a>
                    @if (event()!.co_organizers && event()!.co_organizers!.length > 0) {
                      <span class="text-white/30"> · </span>
                      {{ formatCoOrganizers(event()!.co_organizers!) }}
                    }
                  </p>
                }
                <div class="flex items-start justify-between gap-4 mb-5">
                  <h1 class="text-3xl sm:text-4xl font-black text-white uppercase leading-tight">{{ event()!.title }}</h1>
                  <div class="flex items-center gap-3 flex-shrink-0 mt-1">
                    <button (click)="onLikeClick()" title="Like"
                      class="flex items-center gap-1.5 transition-colors"
                      [class]="liked() ? 'text-red-400 hover:text-red-300' : 'text-white/30 hover:text-white/70'">
                      <svg class="w-5 h-5" [attr.fill]="liked() ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                      </svg>
                      @if (likeCount() > 0) {
                        <span class="text-xs font-mono">{{ likeCount() }}</span>
                      }
                    </button>
                    <button (click)="shareModalOpen.set(true)" title="Share"
                      class="text-white/30 hover:text-white/70 transition-colors">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Date & time -->
                <div class="flex items-start gap-3 mb-3">
                  <svg class="w-4 h-4 text-yellow-400/70 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <div>
                    <p class="font-mono text-white text-sm">{{ event()!.date_and_time | date:'EEEE, MMMM d, y' }}</p>
                    <p class="font-mono text-white/50 text-xs">{{ event()!.date_and_time | date:'h:mm a' }}</p>
                  </div>
                </div>

                <!-- Venue -->
                @if (event()!.venue || event()!.venue_address) {
                  <div class="flex items-start gap-3 mb-5">
                    <svg class="w-4 h-4 text-yellow-400/70 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <div>
                      @if (event()!.venue) {
                        <p class="font-mono text-white text-sm">{{ event()!.venue }}</p>
                      }
                      @if (event()!.venue_address) {
                        <p class="font-mono text-white/40 text-xs mt-0.5">{{ event()!.venue_address }}</p>
                      }
                      @if (event()!.venue_maps_url) {
                        <a [href]="event()!.venue_maps_url" target="_blank" rel="noopener"
                          class="text-xs font-mono text-yellow-400/70 hover:text-yellow-400 uppercase tracking-wider transition-colors mt-1 inline-block">
                          View on maps →
                        </a>
                      }
                    </div>
                  </div>
                }

                <!-- Event type + tags -->
                @if (event()!.event_type || (event()!.tags && event()!.tags!.length > 0)) {
                  <div class="flex flex-wrap gap-1.5 mb-5">
                    @if (event()!.event_type) {
                      <span class="px-2.5 py-1 text-xs font-mono text-yellow-400/80 border border-yellow-400/30 uppercase tracking-wide">{{ event()!.event_type!.replace('_', ' ') }}</span>
                    }
                    @for (tag of (event()!.tags || []); track tag.id) {
                      <span class="px-2.5 py-1 text-xs font-mono text-white/40 border border-white/15">{{ tag.name }}</span>
                    }
                  </div>
                }

                <!-- Status / CTA + attending count -->
                <div class="flex flex-wrap items-center gap-4">
                  <div class="flex flex-wrap items-center gap-3">
                    @if (event()!.external_ticket_link) {
                      <a [href]="normalizeUrl(event()!.external_ticket_link)" target="_blank" rel="noopener noreferrer"
                        class="inline-flex flex-col px-7 py-3 bg-yellow-400 hover:bg-yellow-300 text-black transition-colors shadow-lg">
                        <span class="font-black uppercase tracking-wider text-sm leading-tight">Get Tickets ↗</span>
                      </a>
                    } @else if (event()!.ticketing_enabled === false) {
                      <div class="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-white/20 text-white/30 text-sm font-bold uppercase tracking-wider">
                        <span class="w-2 h-2 rounded-full bg-white/20 flex-shrink-0"></span>
                        Listing Only
                      </div>
                    } @else if (event()!.is_closed) {
                      <div class="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-white/20 text-white/30 text-sm font-bold uppercase tracking-wider">
                        <span class="w-2 h-2 rounded-full bg-white/20 flex-shrink-0"></span>
                        Tickets Closed
                      </div>
                    } @else if (event()!.buy_shortlink) {
                      <a [href]="event()!.buy_shortlink" target="_blank" rel="noopener"
                        class="inline-flex flex-col px-7 py-3 bg-yellow-400 hover:bg-yellow-300 text-black transition-colors shadow-lg">
                        <span class="font-black uppercase tracking-wider text-sm leading-tight">Get Tickets →</span>
                        <span class="text-xs font-mono leading-tight opacity-70">{{ event()!.ticket_price === 0 ? 'FREE' : event()!.ticket_price_display }}</span>
                      </a>
                    }

                    @if (event()!.member_discount_type && event()!.member_discount_amount) {
                      @if (isAudienceLoggedIn()) {
                        <div class="flex items-center gap-1.5 px-3 py-1.5 border border-yellow-400/40 bg-yellow-400/10">
                          <svg class="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
                          </svg>
                          <span class="text-xs font-mono text-yellow-400 uppercase tracking-wide">
                            @if (event()!.member_discount_type === 'fixed') {
                              <strong>₱{{ event()!.member_discount_amount | number:'1.0-0' }} off</strong> for <strong>Your Scene&#8482;</strong> members
                            } @else {
                              <strong>{{ event()!.member_discount_amount }}% off</strong> for <strong>Your Scene&#8482;</strong> members
                            }
                          </span>
                        </div>
                      } @else {
                        <div class="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 bg-white/5">
                          <svg class="w-3.5 h-3.5 text-white/40 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
                          </svg>
                          <span class="text-xs font-mono text-white/40 uppercase tracking-wide">
                            @if (event()!.member_discount_type === 'fixed') {
                              <strong>₱{{ event()!.member_discount_amount | number:'1.0-0' }} off</strong> for <strong>Your Scene&#8482;</strong> members ·
                            } @else {
                              <strong>{{ event()!.member_discount_amount }}% off</strong> for <strong>Your Scene&#8482;</strong> members ·
                            }
                          </span>
                          <a routerLink="/login" [queryParams]="{ mode: 'audience' }" class="text-xs font-mono text-yellow-400/80 hover:text-yellow-400 uppercase tracking-wide transition-colors">Sign up</a>
                        </div>
                      }
                    }
                  </div>

                  @if (event()!.tickets_sold && event()!.tickets_sold! > 0) {
                    <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10">
                      <svg class="w-4 h-4 text-yellow-400/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                      <span class="font-mono text-sm text-white/70"><span class="text-white font-bold">{{ event()!.tickets_sold }}</span> attending</span>
                    </div>
                  }
                </div>

              </div>

              <!-- Who's going avatar stack (logged-in only) -->
              @if (isAudienceLoggedIn() && attendees().length > 0) {
                <div class="mt-4 flex items-center gap-3">
                  <!-- Overlapping avatars (max 5) -->
                  <button type="button" (click)="attendeesModalOpen.set(true)"
                    class="flex items-center hover:opacity-80 transition-opacity">
                    @for (item of attendees().slice(0, 5); track item.user.id; let i = $index) {
                      <div class="w-8 h-8 rounded-full border-2 border-black overflow-hidden flex-shrink-0 flex items-center justify-center"
                        [style.margin-left]="i === 0 ? '0' : '-8px'"
                        [style.z-index]="5 - i"
                        [style.position]="'relative'">
                        @if (item.user.profile_photo_url) {
                          <img [src]="item.user.profile_photo_url" [alt]="item.user.first_name" class="w-full h-full object-cover">
                        } @else {
                          <div class="w-full h-full bg-white flex items-center justify-center">
                            <span class="text-black text-[10px] font-black">{{ item.user.first_name.charAt(0).toUpperCase() }}</span>
                          </div>
                        }
                      </div>
                    }
                    @if (attendees().length > 5) {
                      <div class="w-8 h-8 rounded-full border-2 border-black bg-white/10 flex items-center justify-center flex-shrink-0 relative"
                        style="margin-left: -8px; z-index: 0">
                        <span class="text-white text-[9px] font-black">+{{ attendees().length - 5 }}</span>
                      </div>
                    }
                  </button>
                  <button type="button" (click)="attendeesModalOpen.set(true)"
                    class="text-xs font-mono text-white/40 hover:text-white/70 transition-colors">
                    See who's going →
                  </button>
                </div>
              }

            </div>
          </div>
        </section>

        <!-- Divider -->
        <div class="border-t-2 border-white/10"></div>

        <!-- Details section -->
        <section class="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-10">

            <!-- Left: description + ticket types -->
            <div class="md:col-span-2 space-y-10">
              @if (event()!.description) {
                <div>
                  <h2 class="text-xs font-mono text-white/30 uppercase tracking-widest mb-4">About this show</h2>
                  <div class="text-white/70 text-sm leading-relaxed font-mono prose-event" [innerHTML]="formatDescription(event()!.description!)"></div>
                </div>
              }

              @if (event()!.ticketing_enabled !== false && event()!.ticketTypes && event()!.ticketTypes!.length > 0) {
                <div>
                  <h2 class="text-xs font-mono text-white/30 uppercase tracking-widest mb-4">Ticket Types</h2>
                  <div class="space-y-2">
                    @for (tt of event()!.ticketTypes!; track tt.id) {
                      <div class="flex items-center justify-between p-4 border border-white/10 bg-zinc-950">
                        <div>
                          <p class="text-white text-sm font-bold uppercase">{{ tt.name }}</p>
                          @if (tt.special_instructions) {
                            <p class="text-white/35 text-xs font-mono mt-0.5">{{ tt.special_instructions }}</p>
                          }
                          @if (tt.remaining_tickets !== null && tt.remaining_tickets !== undefined && tt.remaining_tickets <= 20 && !tt.is_sold_out) {
                            <p class="text-yellow-400/70 text-xs font-mono mt-0.5 uppercase">Only {{ tt.remaining_tickets }} left</p>
                          }
                        </div>
                        <div class="text-right flex-shrink-0 ml-4">
                          <p class="text-white font-black text-sm">
                            {{ tt.price === 0 ? 'FREE' : ('₱' + (tt.price | number:'1.0-0')) }}
                          </p>
                          @if (tt.is_sold_out) {
                            <p class="text-white/25 text-xs font-mono uppercase mt-0.5">Sold out</p>
                          } @else if (!tt.is_available) {
                            <p class="text-white/25 text-xs font-mono uppercase mt-0.5">Not available</p>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- CTA below ticket types -->
                  @if (!event()!.is_closed && (event()!.external_ticket_link || event()!.buy_shortlink)) {
                    <div class="mt-6">
                      @if (event()!.external_ticket_link) {
                        <a [href]="normalizeUrl(event()!.external_ticket_link)" target="_blank" rel="noopener noreferrer"
                          class="inline-flex flex-col px-7 py-3 bg-yellow-400 hover:bg-yellow-300 text-black transition-colors">
                          <span class="font-black uppercase tracking-wider text-sm leading-tight">Get Tickets ↗</span>
                        </a>
                      } @else {
                        <a [href]="event()!.buy_shortlink" target="_blank" rel="noopener"
                          class="inline-flex flex-col px-7 py-3 bg-yellow-400 hover:bg-yellow-300 text-black transition-colors">
                          <span class="font-black uppercase tracking-wider text-sm leading-tight">Get Tickets →</span>
                          <span class="text-xs font-mono leading-tight opacity-70">{{ event()!.ticket_price_display }}</span>
                        </a>
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Right: sidebar details -->
            <div class="space-y-6">
              <!-- Date summary card -->
              <div class="border border-white/10 p-4">
                <p class="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">Date & Time</p>
                <p class="text-white font-bold text-sm">{{ event()!.date_and_time | date:'EEE, MMM d, y' }}</p>
                <p class="text-white/50 text-xs font-mono mt-0.5">{{ event()!.date_and_time | date:'h:mm a' }}</p>
                @if (event()!.close_time) {
                  <p class="text-white/30 text-xs font-mono mt-1">Closes {{ event()!.close_time | date:'h:mm a' }}</p>
                }
              </div>

              <!-- Venue card -->
              @if (event()!.venue) {
                <div class="border border-white/10 p-4">
                  <p class="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">Venue</p>
                  <p class="text-white font-bold text-sm">{{ event()!.venue }}</p>
                  @if (event()!.venue_address) {
                    <p class="text-white/40 text-xs font-mono mt-1">{{ event()!.venue_address }}</p>
                  }
                  @if (event()!.venue_phone) {
                    <p class="text-white/40 text-xs font-mono mt-1">{{ event()!.venue_phone }}</p>
                  }
                  @if (event()!.venue_maps_url) {
                    <a [href]="event()!.venue_maps_url" target="_blank" rel="noopener"
                      class="text-xs font-mono text-yellow-400/70 hover:text-yellow-400 uppercase tracking-wider transition-colors mt-2 inline-block">
                      Open in Maps →
                    </a>
                  }
                </div>
              }

              <!-- Organizer card -->
              @if (event()!.brand) {
                <div class="border border-white/10 p-4">
                  <p class="text-xs font-mono text-white/30 uppercase tracking-widest mb-3">{{ allOrganizers().length > 1 ? 'Organizers' : 'Organizer' }}</p>
                  <div class="flex items-center">
                    @for (org of allOrganizers(); track org.id; let i = $index) {
                      <div class="relative group/avatar" [style.z-index]="allOrganizers().length - i" [style.margin-left]="i === 0 ? '0' : '-10px'">
                        <a [routerLink]="['/organizers', org.id]"
                          class="block w-10 h-10 rounded-full border-2 border-black overflow-hidden flex-shrink-0 transition-transform duration-150 hover:scale-110 hover:z-50 relative"
                          [style.background-color]="org.color || '#18181b'">
                          @if (org.logo_url) {
                            <img [src]="org.logo_url" [alt]="org.name" class="w-full h-full object-cover">
                          } @else {
                            <span class="w-full h-full flex items-center justify-center text-white font-black text-sm uppercase select-none">{{ org.name.charAt(0) }}</span>
                          }
                        </a>
                        <!-- Tooltip -->
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-white text-black text-[10px] font-bold uppercase tracking-wide whitespace-nowrap pointer-events-none opacity-0 group-hover/avatar:opacity-100 transition-opacity z-50">
                          {{ org.name }}
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

          </div>
        </section>

      }
    </main>

    <!-- Footer -->
    <footer class="bg-black border-t-2 border-white/10 py-6 px-4 sm:px-6">
      <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-4 opacity-25">
        <div class="flex items-center gap-6 text-xs font-mono text-white/20">
          <a href="/#shows" class="hover:text-white/50 uppercase tracking-wider transition-colors">All Shows</a>
          <a routerLink="/app/login" [queryParams]="{ mode: 'organizer' }" class="hover:text-white/50 uppercase tracking-wider transition-colors">List a Show</a>
        </div>
      </div>
    </footer>

    <!-- Who's going modal -->
    @if (attendeesModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" (click)="attendeesModalOpen.set(false)">
        <div class="absolute inset-0 bg-black/70"></div>
        <div class="relative w-full max-w-sm bg-black border border-white/20 shadow-2xl max-h-[80vh] flex flex-col"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
            <p class="text-xs font-mono text-white/40 uppercase tracking-widest">Who's going</p>
            <button type="button" (click)="attendeesModalOpen.set(false)" class="text-white/30 hover:text-white transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="overflow-y-auto flex-1">
            @for (item of attendees(); track item.user.id) {
              <div class="flex items-center gap-3 px-5 py-3 border-b border-white/5">
                @if (item.user.profile_photo_url) {
                  <img [src]="item.user.profile_photo_url" [alt]="item.user.first_name"
                    class="w-9 h-9 object-cover border border-white/20 flex-shrink-0">
                } @else {
                  <div class="w-9 h-9 bg-white flex items-center justify-center border border-white/20 flex-shrink-0">
                    <span class="text-black text-xs font-black">{{ item.user.first_name.charAt(0).toUpperCase() }}</span>
                  </div>
                }
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-black text-white uppercase truncate leading-tight">
                    {{ item.user.first_name }} {{ item.user.last_name_initial }}
                  </p>
                  @if (item.user.city) {
                    <p class="text-[10px] font-mono text-white/30 truncate">{{ item.user.city }}</p>
                  }
                </div>
                <app-connect-button
                  [userId]="item.user.id"
                  [connectionMeta]="item.connection"
                  (connectionChanged)="onAttendeeConnectionChanged(item, $event)">
                </app-connect-button>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- Share modal -->
    @if (shareModalOpen() && event()) {
      <app-share-modal
        [url]="currentUrl()"
        [title]="event()!.title"
        (close)="shareModalOpen.set(false)">
      </app-share-modal>
    }

    <!-- Audience auth modal -->
    @if (showAuthModal()) {
      <app-audience-auth-modal
        [signupReturnUrl]="signupReturnUrl()"
        (closed)="showAuthModal.set(false)"
        (authenticated)="onModalAuthenticated()">
      </app-audience-auth-modal>
    }
  `
})
export class EventViewComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal(false);
  event = signal<PublicEventView | null>(null);
  shareModalOpen = signal(false);
  attendeesModalOpen = signal(false);
  attendees = signal<AudienceAttendee[]>([]);

  allOrganizers = computed(() => {
    const ev = this.event();
    if (!ev?.brand) return [];
    const owner = { id: ev.brand.id, name: ev.brand.name, logo_url: ev.brand.logo_url ?? null, color: ev.brand.color ?? null };
    const collabs = (ev.co_organizers || []).map(c => ({ id: c.id, name: c.name, logo_url: c.logo_url ?? null, color: null }));
    return [owner, ...collabs];
  });
  showAuthModal = signal(false);
  liked = signal(false);
  likeCount = signal(0);
  currentUrl = () => window.location.href;

  isAudienceLoggedIn = () => this.audienceAuth.isLoggedIn();

  signupReturnUrl = () => {
    const ev = this.event();
    return ev ? `/events/${ev.id}?pendingLike=true` : '/';
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private titleService: Title,
    private metaService: Meta,
    private audienceAuth: AudienceAuthService,
    private audienceSocial: AudienceSocialService,
    private router: Router
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }

    const pendingLike = this.route.snapshot.queryParamMap.get('pendingLike');
    const audienceToken = this.audienceAuth.getToken();
    const headers: Record<string, string> = audienceToken ? { Authorization: `Bearer ${audienceToken}` } : {};
    this.http.get<{ event: PublicEventView }>(`${environment.apiUrl}/public/events/${id}`, { headers }).subscribe({
      next: (res) => {
        if (res.event.listed_on_ticketing === false) {
          this.error.set(true);
          this.loading.set(false);
          return;
        }
        this.event.set(res.event);
        this.liked.set(res.event.user_liked ?? false);
        this.likeCount.set(res.event.like_count ?? 0);
        this.loading.set(false);
        this.updateSEOTags(res.event);

        if (pendingLike && this.audienceAuth.isLoggedIn()) {
          this.toggleLike();
          this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }

        if (this.audienceAuth.isLoggedIn()) {
          this.audienceSocial.discoverAtEvent(res.event.id).subscribe({
            next: (r) => this.attendees.set(r.attendees),
            error: () => {},
          });
        }
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
        this.titleService.setTitle('Event Not Found');
      }
    });
  }

  ngOnDestroy(): void {
    // Reset meta tags when leaving the page
    this.metaService.removeTag('name="description"');
    this.metaService.removeTag('name="keywords"');
    this.metaService.removeTag('property="og:title"');
    this.metaService.removeTag('property="og:description"');
    this.metaService.removeTag('property="og:image"');
    this.metaService.removeTag('property="og:type"');
    this.metaService.removeTag('property="og:url"');
    this.metaService.removeTag('name="twitter:card"');
    this.metaService.removeTag('name="twitter:title"');
    this.metaService.removeTag('name="twitter:description"');
    this.metaService.removeTag('name="twitter:image"');
  }

  onLikeClick(): void {
    if (this.audienceAuth.isLoggedIn()) {
      this.toggleLike();
    } else {
      this.showAuthModal.set(true);
    }
  }

  onModalAuthenticated(): void {
    this.showAuthModal.set(false);
    this.toggleLike();
  }

  normalizeUrl(url: string | null | undefined): string {
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
  }

  toggleLike(): void {
    const ev = this.event();
    if (!ev) return;
    this.audienceAuth.toggleEventLike(ev.id).subscribe({
      next: (res) => {
        this.liked.set(res.liked);
        this.likeCount.set(res.like_count);
      }
    });
  }

  onAttendeeConnectionChanged(item: AudienceAttendee, meta: ConnectionMeta | null): void {
    this.attendees.update((list) =>
      list.map((a) => a.user.id === item.user.id ? { ...a, connection: meta } : a)
    );
  }

  formatCoOrganizers(brands: { name: string }[]): string {
    if (brands.length === 0) return '';
    if (brands.length === 1) return brands[0].name;
    if (brands.length === 2) return `${brands[0].name} and ${brands[1].name}`;
    return brands.slice(0, -1).map(b => b.name).join(', ') + ', and ' + brands[brands.length - 1].name;
  }

  formatDescription(text: string): string {
    // If the content looks like HTML (from the rich text editor), render it directly.
    // Otherwise treat as plain text and convert newlines to <br>.
    const looksLikeHtml = /<[a-z][\s\S]*>/i.test(text);
    if (looksLikeHtml) {
      return text;
    }
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(/\n/g, '<br>');
  }

  private updateSEOTags(event: PublicEventView): void {
    const dateStr = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(new Date(event.date_and_time));

    const venue = event.venue || event.venue_address || '';
    const description = event.description
      ? event.description.slice(0, 160)
      : `${event.title} — local ${event.event_type || 'show'} in the Philippines. ${dateStr}${venue ? ' · ' + venue : ''} · ${event.ticket_price_display}`;

    const pageTitle = `${event.title}${venue ? ' at ' + venue : ''} | Local Show | Your Scene Philippines`;

    // Keywords: always include local/indie base terms + event tags + event name
    const tagNames = (event.tags || []).map(t => t.name);
    const keywords = ['local', 'indie', event.title, ...tagNames, 'local show', 'indie show', 'local concert', 'Philippines', 'live music', event.event_type].filter(Boolean).join(', ');

    this.titleService.setTitle(pageTitle);

    // Standard meta
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ name: 'keywords', content: keywords });

    // Open Graph (Facebook, LinkedIn, WhatsApp, etc.)
    this.metaService.updateTag({ property: 'og:type', content: 'event' });
    this.metaService.updateTag({ property: 'og:title', content: `${event.title} | Local Show | Your Scene` });
    this.metaService.updateTag({ property: 'og:description', content: description });
    if (event.poster_url) {
      this.metaService.updateTag({ property: 'og:image', content: event.poster_url });
    }
    this.metaService.updateTag({ property: 'og:url', content: window.location.href });

    // Twitter card
    this.metaService.updateTag({ name: 'twitter:card', content: event.poster_url ? 'summary_large_image' : 'summary' });
    this.metaService.updateTag({ name: 'twitter:title', content: `${event.title} | Local Show | Your Scene` });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    if (event.poster_url) {
      this.metaService.updateTag({ name: 'twitter:image', content: event.poster_url });
    }
  }
}
