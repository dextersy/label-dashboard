import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-audience-privacy',
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
          <a routerLink="/terms" class="text-xs font-mono text-white/30 hover:text-yellow-400 uppercase tracking-wider transition-colors">Terms & Conditions</a>
          <a routerLink="/login" class="text-xs font-mono text-white/30 hover:text-yellow-400 uppercase tracking-wider transition-colors">← Back to sign in</a>
        </div>
      </div>

      <div class="max-w-3xl mx-auto px-6 py-12">
        <p class="text-xs font-mono text-yellow-400 uppercase tracking-[0.25em] mb-3">— legal —</p>
        <h1 class="text-3xl font-black uppercase tracking-tight mb-2">Privacy Policy</h1>
        <p class="text-xs font-mono text-white/30 mb-2">For ticket buyers and audience members</p>
        <p class="text-xs font-mono text-white/30 mb-10">Last updated: August 2026</p>

        <div class="space-y-10 text-sm font-mono text-white/60 leading-relaxed">

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">1. Introduction</h2>
            <p>Your Scene ("Platform", "we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use the Platform as a ticket buyer or audience member.</p>
            <p class="mt-3">This Policy complies with the General Data Protection Regulation (GDPR), the Children's Online Privacy Protection Act (COPPA), and other applicable privacy laws.</p>
            <p class="mt-3">This document is provided for transparency — to tell you clearly what data we process, why we process it, and what rights you have. Most of our processing is necessary to deliver the services you have requested (creating an account, delivering tickets) or is based on our legitimate interests in operating a secure platform. We do not rely on "consent to this Privacy Policy" as a legal basis for routine data processing. Where we do rely on your consent — for example for optional communications — we will ask for it separately and you may withdraw it at any time without affecting your access to the Platform. See <a (click)="scrollTo('your-rights')" class="text-yellow-400 hover:text-yellow-300 underline transition-colors cursor-pointer">Your Rights</a> for more.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">2. Children's Privacy (COPPA)</h2>
            <p>The Platform is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information without your consent, please contact us immediately and we will delete that information.</p>
            <p class="mt-3">Users between the ages of 13 and 18 may use the Platform only with the consent of a parent or legal guardian. By creating an account, you represent that you are at least 13 years old.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">3. What Data We Collect</h2>
            <p>We collect the following categories of personal data:</p>

            <div class="mt-4 space-y-4">
              <div>
                <p class="text-white/80 font-bold mb-1">Account Information</p>
                <ul class="space-y-1 list-disc list-inside">
                  <li>First and last name</li>
                  <li>Email address</li>
                  <li>Password (stored as a one-way hash — we cannot read it)</li>
                  <li>Profile photo (if uploaded)</li>
                  <li>Phone number (optional)</li>
                </ul>
              </div>
              <div>
                <p class="text-white/80 font-bold mb-1">Ticket and Transaction Data</p>
                <ul class="space-y-1 list-disc list-inside">
                  <li>Tickets purchased, including event names, dates, and ticket codes</li>
                  <li>Payment confirmation details (we do not store full card numbers)</li>
                  <li>Your membership ID and tier</li>
                </ul>
              </div>
              <div>
                <p class="text-white/80 font-bold mb-1">Consent Records</p>
                <ul class="space-y-1 list-disc list-inside">
                  <li>Timestamps recording when you accepted these Terms and this Privacy Policy</li>
                  <li>Age confirmation timestamp</li>
                </ul>
              </div>
              <div>
                <p class="text-white/80 font-bold mb-1">Technical Data</p>
                <ul class="space-y-1 list-disc list-inside">
                  <li>IP address and general location (for fraud prevention and security)</li>
                  <li>Browser type and device information</li>
                  <li>Log data (access times, pages viewed)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">4. How We Use Your Data</h2>
            <p>The table below sets out each processing purpose alongside the legal basis we rely on. Where we rely on legitimate interests, we have assessed that those interests are not overridden by your rights and freedoms.</p>
            <div class="mt-4 space-y-3">
              <div class="border border-white/10 p-4">
                <p class="text-white/80 font-bold mb-1">Account creation and management</p>
                <p>To create your account, verify your identity, and maintain your profile.</p>
                <p class="mt-1 text-yellow-400/70 text-xs uppercase tracking-wider">Legal basis: Contract performance</p>
              </div>
              <div class="border border-white/10 p-4">
                <p class="text-white/80 font-bold mb-1">Ticket delivery</p>
                <p>To link tickets to your account, issue ticket codes, send purchase confirmations, and provide event access.</p>
                <p class="mt-1 text-yellow-400/70 text-xs uppercase tracking-wider">Legal basis: Contract performance</p>
              </div>
              <div class="border border-white/10 p-4">
                <p class="text-white/80 font-bold mb-1">Transactional communications</p>
                <p>To send emails that are necessary to deliver the service: email verification, password resets, ticket confirmations, and event updates from organizers.</p>
                <p class="mt-1 text-yellow-400/70 text-xs uppercase tracking-wider">Legal basis: Contract performance</p>
              </div>
              <div class="border border-white/10 p-4">
                <p class="text-white/80 font-bold mb-1">Security and fraud prevention</p>
                <p>To detect, investigate, and prevent fraudulent transactions, unauthorized account access, and other abuse.</p>
                <p class="mt-1 text-yellow-400/70 text-xs uppercase tracking-wider">Legal basis: Legitimate interests (maintaining a secure and trustworthy platform)</p>
              </div>
              <div class="border border-white/10 p-4">
                <p class="text-white/80 font-bold mb-1">Platform analytics and improvement</p>
                <p>To understand aggregate usage patterns and improve Platform features. Where possible we use anonymized or pseudonymized data for this purpose.</p>
                <p class="mt-1 text-yellow-400/70 text-xs uppercase tracking-wider">Legal basis: Legitimate interests (improving our service)</p>
              </div>
              <div class="border border-white/10 p-4">
                <p class="text-white/80 font-bold mb-1">Legal compliance and record-keeping</p>
                <p>To comply with applicable laws (including tax, financial, and data protection obligations) and to record consent where it is obtained for specific optional activities.</p>
                <p class="mt-1 text-yellow-400/70 text-xs uppercase tracking-wider">Legal basis: Legal obligation / Legitimate interests</p>
              </div>
              <div class="border border-white/10 p-4">
                <p class="text-white/80 font-bold mb-1">Optional marketing communications</p>
                <p>To send you newsletters, promotional offers, or event recommendations. We will only do this if you have explicitly opted in. You may withdraw this consent at any time via the unsubscribe link in any marketing email, without affecting your access to the Platform.</p>
                <p class="mt-1 text-yellow-400/70 text-xs uppercase tracking-wider">Legal basis: Consent (freely given, separately obtained, and withdrawable)</p>
              </div>
            </div>
            <p class="mt-4">We do not use your data for targeted advertising and we do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">5. Legal Basis for Processing (GDPR)</h2>
            <p>For users in the European Economic Area (EEA) and United Kingdom, this section summarises the lawful bases under Article 6 GDPR on which we rely. The specific basis for each processing activity is identified in Section 4 above.</p>
            <ul class="mt-3 space-y-3 list-disc list-inside">
              <li>
                <span class="text-white/80">Contract performance (Art. 6(1)(b)):</span> The majority of processing — account management, ticket delivery, and transactional communications — is necessary to perform the contract with you when you create an account or purchase a ticket. Without this processing we cannot provide the service.
              </li>
              <li>
                <span class="text-white/80">Legitimate interests (Art. 6(1)(f)):</span> We rely on legitimate interests for security, fraud prevention, and aggregate analytics. In each case we have assessed that our interest is genuine, that the processing is necessary and proportionate, and that it does not override your fundamental rights. You have the right to object to processing based on legitimate interests — see Section 8.
              </li>
              <li>
                <span class="text-white/80">Legal obligation (Art. 6(1)(c)):</span> Some processing is required to comply with laws that apply to us, such as financial record-keeping obligations.
              </li>
              <li>
                <span class="text-white/80">Consent (Art. 6(1)(a)):</span> We rely on consent only for optional activities such as marketing emails. Consent is always freely given, specific, informed, and unambiguous — obtained through a clear opt-in action separate from account creation. Accepting this Privacy Policy is not treated as consent to any processing activity. Where consent is the basis, you may withdraw it at any time without detriment.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">6. Data Sharing</h2>
            <p>We do not sell your personal data. We may share your data with:</p>
            <ul class="mt-2 space-y-1.5 list-disc list-inside">
              <li><span class="text-white/80">Event organizers:</span> Limited information (such as your name and email) is shared with the organizer of events you purchase tickets for, to fulfill the transaction and for event entry purposes.</li>
              <li><span class="text-white/80">Payment processors:</span> Third-party payment processors handle all card and payment transactions directly. We do not store full card numbers, CVV codes, or bank account details. Payment data is transmitted to and held by the processor under PCI-DSS standards. By making a purchase, you also agree to the applicable payment processor's terms of service and privacy policy.</li>
              <li><span class="text-white/80">Cloud infrastructure providers:</span> We use third-party cloud services (including storage) to operate the Platform. These providers are bound by data processing agreements.</li>
              <li><span class="text-white/80">Legal authorities:</span> Where required by law, court order, or to protect our legal rights.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">7. Data Retention</h2>
            <p>We retain your personal data for as long as your account is active and for a reasonable period thereafter, or as required by law. Specifically:</p>
            <ul class="mt-2 space-y-1.5 list-disc list-inside">
              <li>Account data is retained for the life of your account plus up to 3 years after deletion, unless a longer period is required by law.</li>
              <li><span class="text-white/80">Event entry data</span> (name, email address, and ticket code associated with an active ticket) is retained until the event date has passed. This data is the minimum necessary to verify your admission at the door and is held for the sole purpose of event entry. Once the event date passes, this data is no longer actively used for entry purposes and reverts to standard transaction record retention.</li>
              <li>Transaction records (ticket purchases) may be retained for up to 7 years for accounting and legal compliance purposes.</li>
              <li>Consent records are retained indefinitely to demonstrate compliance.</li>
              <li>Technical logs are retained for up to 90 days.</li>
            </ul>
          </section>

          <section id="your-rights">
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">8. Your Rights</h2>
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul class="mt-2 space-y-2 list-disc list-inside">
              <li><span class="text-white/80">Right of access:</span> Request a copy of the personal data we hold about you.</li>
              <li><span class="text-white/80">Right to rectification:</span> Request correction of inaccurate or incomplete data.</li>
              <li><span class="text-white/80">Right to erasure ("right to be forgotten"):</span> Request deletion of your personal data, subject to legal retention requirements.</li>
              <li><span class="text-white/80">Right to restriction:</span> Request that we limit processing of your data in certain circumstances.</li>
              <li><span class="text-white/80">Right to data portability:</span> Request your data in a structured, machine-readable format.</li>
              <li><span class="text-white/80">Right to withdraw consent:</span> Withdraw consent at any time where processing is based on consent. Withdrawal does not affect the lawfulness of prior processing.</li>
              <li><span class="text-white/80">Right to object:</span> Object to processing based on legitimate interests.</li>
            </ul>
            <p class="mt-3">To exercise any of these rights, contact us through the Platform's support channels. We will respond within 30 days. You also have the right to lodge a complaint with a supervisory authority in your jurisdiction.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">9. Account Deletion</h2>
            <p>You may request deletion of your account at any time by contacting us. Upon receiving your request, we will:</p>
            <ul class="mt-2 space-y-1.5 list-disc list-inside">
              <li>Remove your account and profile data from our active systems within 30 days.</li>
              <li>Anonymize or delete your data from our backups within 90 days.</li>
              <li>Retain certain records (such as transaction history) where required by law.</li>
            </ul>
            <p class="mt-3">Note that deleting your account does not revoke tickets already purchased. Transaction records linked to purchases may be retained in anonymized form.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">10. Cookies and Tracking</h2>
            <p>The Platform uses local storage and session mechanisms to keep you logged in. We do not use third-party advertising cookies. We may use minimal analytics to understand aggregate Platform usage.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">11. Security</h2>
            <p>We implement technical and organizational security measures to protect your personal data, including encrypted data transmission (HTTPS), hashed passwords, and access controls. However, no system is completely secure — we cannot guarantee absolute security of your data.</p>
            <p class="mt-3">If you suspect your account has been compromised, please change your password immediately and contact us.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by displaying a prominent notice on the Platform. The updated Policy will take effect on the date stated at the top of this page.</p>
            <p class="mt-3">Your continued use of the Platform after the effective date of any changes constitutes your acceptance of the updated Policy. If you do not agree with any changes, you may delete your account.</p>
          </section>

          <section>
            <h2 class="text-white font-black uppercase tracking-wide text-base mb-3">13. Contact and Data Controller</h2>
            <p>If you have any questions about this Privacy Policy, wish to exercise your rights, or need to report a privacy concern, please contact us through the Platform's support channels.</p>
            <p class="mt-3">For GDPR purposes, the data controller is the operator of the Your Scene platform.</p>
          </section>

        </div>

        <div class="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-4 justify-center">
          <a routerLink="/terms"
            class="inline-block px-6 py-2.5 border border-white/20 hover:border-yellow-400 text-white/60 hover:text-yellow-400 text-xs font-black uppercase tracking-wider transition-colors text-center">
            Terms & Conditions →
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
export class AudiencePrivacyComponent {
  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
