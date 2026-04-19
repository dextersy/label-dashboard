import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black text-white">
      <!-- Header -->
      <div class="border-b border-white/10 px-6 py-5 flex items-center justify-between">
        <a routerLink="/" class="h-5 opacity-30 hover:opacity-60 transition-opacity">
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-full">
        </a>
        <a routerLink="/app/signup" class="text-xs font-mono text-white/30 hover:text-yellow-400 uppercase tracking-wider transition-colors">
          ← Back to signup
        </a>
      </div>

      <div class="max-w-3xl mx-auto px-6 py-12">
        <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-3">— legal —</p>
        <h1 class="text-3xl font-black uppercase tracking-tight mb-2">Terms and Conditions</h1>
        <p class="text-xs font-mono text-white/30 mb-10">Last updated: April 2026</p>

        <div class="space-y-10 text-sm font-mono text-white/60 leading-relaxed">

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account on the Your Scene organizer portal ("Platform"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree, do not create an account or use the Platform.</p>
            <p class="mt-3">These Terms apply to organizers — individuals or entities who create accounts to list events and manage ticket sales on the Platform. They do not apply to ticket buyers, who are subject to separate purchase terms displayed at the point of sale.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">2. Organizer Accounts</h2>
            <p>You must be at least 18 years old to create an organizer account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.</p>
            <p class="mt-3">You agree to provide accurate, current, and complete information when creating your account and to update that information as needed. Accounts containing false or misleading information may be suspended or terminated.</p>
            <p class="mt-3">Each account is personal to the registered organizer. You may not transfer your account to another party without prior written consent from the Platform.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">3. Event Listings</h2>
            <p>As an organizer, you are solely responsible for the accuracy and legality of all event information you publish, including but not limited to: event title, date, time, venue, ticket prices, refund policy, age restrictions, and any special conditions.</p>
            <p class="mt-3">You represent and warrant that:</p>
            <ul class="mt-2 space-y-1.5 list-disc list-inside">
              <li>You have the legal right to hold and promote the event.</li>
              <li>The event does not violate any applicable laws, regulations, or third-party rights.</li>
              <li>All venues, performers, and associated parties have provided necessary approvals.</li>
              <li>Ticket prices and fees are accurately represented to buyers.</li>
            </ul>
            <p class="mt-3">The Platform reserves the right to remove any event listing that violates these Terms or that we determine, in our sole discretion, to be inappropriate, misleading, or harmful.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">4. Ticket Sales and Payments</h2>
            <p>You acknowledge that the Platform facilitates ticket sales on your behalf. You are responsible for delivering the event as advertised to ticket holders.</p>
            <p class="mt-3">If an event is cancelled or significantly changed (including date, venue, or lineup changes), you are responsible for communicating these changes to ticket holders promptly and processing any refunds owed in accordance with your stated refund policy and applicable consumer protection laws.</p>
            <p class="mt-3">The Platform's payment processing features are provided as a convenience. You are responsible for ensuring compliance with all applicable tax obligations arising from ticket sales.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">5. Prohibited Conduct</h2>
            <p>You agree not to use the Platform to:</p>
            <ul class="mt-2 space-y-1.5 list-disc list-inside">
              <li>List events that are fraudulent, illegal, or deceptive.</li>
              <li>Sell tickets for events you do not have the right to promote.</li>
              <li>Engage in unauthorized data collection or harvesting of attendee information.</li>
              <li>Transmit spam, malware, or unsolicited communications to ticket buyers.</li>
              <li>Circumvent or interfere with the Platform's security features or technical measures.</li>
              <li>Impersonate another organizer, venue, or entity.</li>
              <li>Use the Platform for any purpose that violates applicable laws or regulations.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">6. Data and Privacy</h2>
            <p>Attendee data collected through ticket purchases (including names, email addresses, and payment details) is collected on your behalf. You agree to handle all such data in accordance with applicable privacy laws and not to use it for purposes beyond fulfilling the event transaction and your stated communications.</p>
            <p class="mt-3">The Platform collects and processes your personal data as described in our Privacy Policy. By using the Platform, you consent to this processing.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">7. Intellectual Property</h2>
            <p>You retain ownership of all content you upload to the Platform (event descriptions, images, etc.). By uploading content, you grant the Platform a non-exclusive, royalty-free licence to display and use that content for the purpose of operating and promoting the Platform and your events.</p>
            <p class="mt-3">You must not upload content that infringes the intellectual property rights of any third party.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">8. Termination</h2>
            <p>You may close your account at any time by contacting us. The Platform may suspend or terminate your account at any time if you breach these Terms, or for any other reason at our sole discretion, with or without notice.</p>
            <p class="mt-3">Upon termination, your access to the Platform will cease. Any outstanding obligations relating to events already listed (including refunds) remain your responsibility.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, the Platform is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform, including but not limited to lost revenue, event cancellations, or data loss.</p>
            <p class="mt-3">Our total liability to you for any claim arising out of these Terms shall not exceed the fees paid by you to the Platform in the 3 months preceding the claim.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">10. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. If we make material changes, we will notify you via email or by displaying a notice within the Platform. Your continued use of the Platform after the effective date of any changes constitutes your acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">11. Governing Law</h2>
            <p>These Terms are governed by the laws of the jurisdiction in which the Platform operates. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of that jurisdiction.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">12. Contact</h2>
            <p>If you have questions about these Terms, please contact us through the Platform's support channels.</p>
          </section>

        </div>

        <div class="mt-12 pt-8 border-t border-white/10 text-center">
          <a routerLink="/app/signup"
            class="inline-block px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors">
            ← Back to signup
          </a>
        </div>
      </div>
    </div>
  `
})
export class TermsComponent {}
