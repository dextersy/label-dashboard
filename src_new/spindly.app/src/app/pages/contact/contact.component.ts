import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-contact',
  imports: [FormsModule, RouterLink],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent implements OnInit {
  form = {
    name: '',
    contact_number: '',
    email: '',
    label_name: '',
    about: ''
  };

  submitting = signal(false);
  submitted = signal(false);
  errorMsg = signal('');

  constructor(private http: HttpClient, private titleService: Title, private meta: Meta) {}

  ngOnInit(): void {
    this.titleService.setTitle('Get Started with Spindly | Label Solutions for Indie Labels');
    this.meta.updateTag({ name: 'description', content: 'Ready to simplify your music business? Get in touch and see how Spindly\'s label management platform can work for your indie label in the Philippines.' });
    this.meta.updateTag({ property: 'og:title', content: 'Get Started with Spindly | Label Solutions for Indie Labels' });
    this.meta.updateTag({ property: 'og:description', content: 'Ready to simplify your music business? Get in touch and see how Spindly\'s label management platform can work for your indie label in the Philippines.' });
    this.meta.updateTag({ property: 'og:url', content: 'https://spindly.app/contact' });
  }

  submit(): void {
    this.errorMsg.set('');

    if (!this.form.name.trim()) { this.errorMsg.set('Name is required.'); return; }
    if (!this.form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
      this.errorMsg.set('A valid email address is required.'); return;
    }
    if (!this.form.about.trim()) { this.errorMsg.set('Please tell us about your label.'); return; }

    this.submitting.set(true);

    this.http.post(`${environment.apiUrl}/public/lead-inquiry`, {
      name: this.form.name.trim(),
      contact_number: this.form.contact_number.trim(),
      email: this.form.email.trim(),
      label_name: this.form.label_name.trim() || undefined,
      about: this.form.about.trim()
    }).subscribe({
      next: () => {
        this.submitted.set(true);
        this.submitting.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error || 'Something went wrong. Please try again.');
        this.submitting.set(false);
      }
    });
  }
}
