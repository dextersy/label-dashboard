import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-audience-terms',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-black text-white">
      <!-- Header -->
      <div class="border-b border-white/10 px-6 py-5 flex items-center justify-between">
        <a routerLink="/" class="h-5 opacity-30 hover:opacity-60 transition-opacity">
          <img src="/assets/logo-dark-bg.png" alt="Your Scene" class="h-full">
        </a>
        <div class="flex items-center gap-6">
          <a routerLink="/privacy" class="text-xs font-mono text-white/30 hover:text-yellow-400 uppercase tracking-wider transition-colors">Privacy Policy</a>
          <a routerLink="/login" class="text-xs font-mono text-white/30 hover:text-yellow-400 uppercase tracking-wider transition-colors">← Back to sign in</a>
        </div>
      </div>

      <div class="max-w-3xl mx-auto px-6 py-12">
        <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-3">— legal —</p>
        <h1 class="text-3xl font-black uppercase tracking-tight mb-2">Terms and Conditions</h1>
        <p class="text-xs font-mono text-white/30 mb-2">For ticket buyers and audience members</p>
        <p class="text-xs font-mono text-white/30 mb-10">Last updated: August 2026</p>

        <div class="space-y-10 text-sm font-mono text-white/60 leading-relaxed">

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">1. Acceptance of Terms</h2>
            <p>By creating an account on Your Scene ("Platform") as a ticket buyer or audience member, you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree, do not create an account or use the Platform.</p>
            <p class="mt-3">These Terms govern your use of the Platform as a member of the audience — someone who browses events, purchases tickets, and manages their ticket history. Organizers (event promoters) are subject to separate organizer terms.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">2. Eligibility and Age Requirements</h2>
            <p>You must be at least 13 years old to create an account on the Platform. If you are under 18, you must have the consent of a parent or legal guardian to use the Platform.</p>
            <p class="mt-3">We do not knowingly collect personal information from children under the age of 13. If we become aware that a user is under 13, we will immediately terminate their account and delete their data in accordance with applicable law, including the Children's Online Privacy Protection Act (COPPA).</p>
            <p class="mt-3">By creating an account, you confirm that you are at least 13 years old.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">3. Your Account</h2>
            <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately if you suspect unauthorized access to your account.</p>
            <p class="mt-3">You agree to provide accurate, current, and complete information when creating your account. Accounts containing false or misleading information may be suspended or terminated.</p>
            <p class="mt-3">Your account is personal to you and may not be transferred to another person.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">4. Ticket Purchases and Payment Processing</h2>
            <p>Tickets purchased through the Platform are subject to the terms set by the individual event organizer, including their refund and cancellation policies. The Platform acts as a marketplace and facilitates transactions between you and the organizer.</p>
            <p class="mt-3">When you purchase a ticket, you will receive confirmation via email. It is your responsibility to ensure your email address is correct and that you retrieve your tickets before the event.</p>
            <p class="mt-3">Tickets previously purchased using your email address — even before you created an account — will be automatically linked to your profile when you sign up or verify your email.</p>
            <p class="mt-3">The Platform does not guarantee the quality, safety, or legality of any event. All disputes regarding events, cancellations, or refunds are between you and the event organizer.</p>

            <h3 class="text-white/80 font-bold uppercase tracking-wide text-sm mt-6 mb-2">4a. Third-Party Payment Processors</h3>
            <p>All payment transactions are processed by third-party payment service providers (each a "Payment Processor"). By completing a purchase, you agree to be bound by the applicable Payment Processor's terms of service and privacy policy in addition to these Terms. The Platform is not a party to your payment transaction and accepts no liability for any payment processing errors, failures, or disputes that are the responsibility of the Payment Processor.</p>
            <p class="mt-3">The Platform does not store your full card number, CVV, or bank account details. Payment credentials are transmitted directly to and held by the Payment Processor in accordance with applicable PCI-DSS standards.</p>
            <p class="mt-3">The Payment Processor may decline a transaction at its sole discretion. The Platform has no ability to override or influence such decisions. If your payment is declined, contact your card issuer or the Payment Processor directly.</p>

            <h3 class="text-white/80 font-bold uppercase tracking-wide text-sm mt-6 mb-2">4b. Platform and Processing Fees</h3>
            <p>Ticket prices may include a platform service fee and/or a third-party payment processing fee ("Fees"). These Fees are displayed before you confirm your purchase. By completing a purchase, you acknowledge and agree that:</p>
            <ul class="mt-2 space-y-1.5 list-disc list-inside">
              <li><strong class="text-white/80">All Fees are non-refundable</strong>, regardless of the circumstances, including event cancellations, postponements, or organizer-initiated refunds. Fees compensate the Platform and the Payment Processor for services already rendered at the time of the transaction.</li>
              <li>If an organizer issues a refund for a ticket, the refunded amount will be the face value of the ticket only. Platform service fees and payment processing fees will not be returned unless explicitly stated otherwise by the organizer at the time of purchase, or as required by applicable consumer protection law.</li>
              <li>The Payment Processor's own fee schedule and non-refund policies also apply and are independent of any refund issued by the organizer or the Platform.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">5. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul class="mt-2 space-y-1.5 list-disc list-inside">
              <li>Use the Platform for any unlawful purpose or in violation of these Terms.</li>
              <li>Resell, transfer, or duplicate tickets in violation of event organizer policies.</li>
              <li>Attempt to circumvent any security, authentication, or access control mechanism.</li>
              <li>Use automated tools to access, scrape, or interact with the Platform.</li>
              <li>Impersonate any person or entity or misrepresent your identity.</li>
              <li>Interfere with or disrupt the operation of the Platform.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">6. Privacy and Data</h2>
            <p>Your use of the Platform is also governed by our <a routerLink="/privacy" class="text-yellow-400 hover:text-yellow-300 underline transition-colors">Privacy Policy</a>, which is incorporated into these Terms by reference. By using the Platform, you consent to the collection and use of your personal data as described in the Privacy Policy.</p>
            <p class="mt-3">We collect only the personal information necessary to operate the Platform and provide you with the services you request. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">7. Intellectual Property</h2>
            <p>All content, features, and functionality of the Platform (including but not limited to text, graphics, logos, and software) are owned by or licensed to the Platform and are protected by applicable intellectual property laws.</p>
            <p class="mt-3">You may not copy, modify, distribute, or create derivative works of any Platform content without prior written permission.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">8. Disclaimers and Limitation of Liability</h2>
            <p>The Platform is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the Platform will be uninterrupted, error-free, or secure.</p>
            <p class="mt-3">To the maximum extent permitted by applicable law, the Platform shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform or attendance at any event.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">9. Account Termination</h2>
            <p>You may request deletion of your account at any time by contacting us. Upon deletion, your personal data will be removed from our active systems in accordance with our <a routerLink="/privacy" class="text-yellow-400 hover:text-yellow-300 underline transition-colors">Privacy Policy</a> and applicable data protection law.</p>
            <p class="mt-3">We reserve the right to suspend or terminate your account if you violate these Terms or if we determine, at our sole discretion, that your account poses a risk to other users or the Platform.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">10. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. If we make material changes, we will notify you via email or by displaying a prominent notice within the Platform. Your continued use of the Platform after any changes take effect constitutes your acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">11. Governing Law</h2>
            <p>These Terms are governed by the laws of the jurisdiction in which the Platform operates. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of that jurisdiction.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">12. Contact</h2>
            <p>If you have questions about these Terms or wish to exercise any rights under applicable data protection law, please contact us through the Platform's support channels.</p>
          </section>

        </div>

        <div class="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-4 justify-center">
          <a routerLink="/privacy"
            class="inline-block px-6 py-2.5 border border-white/20 hover:border-yellow-400 text-white/60 hover:text-yellow-400 text-xs font-black uppercase tracking-wider transition-colors text-center">
            Privacy Policy →
          </a>
          <a routerLink="/login"
            class="inline-block px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black uppercase tracking-wider transition-colors text-center">
            ← Back to sign in
          </a>
        </div>
      </div>
    </div>
  `
})
export class AudienceTermsComponent {}
