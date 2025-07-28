import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private isOpenSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(this.getInitialState());
  public isOpen$: Observable<boolean> = this.isOpenSubject.asObservable();

  constructor() {
    // Handle window resize to auto-close sidebar on mobile
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.handleResize());
    }
  }

  private getInitialState(): boolean {
    // Always start closed on mobile
    return !this.isMobile();
  }

  private handleResize(): void {
    if (this.isMobile()) {
      // Close sidebar when switching to mobile view
      this.closeSidebar();
    }
  }

  private isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 991;
  }

  closeOnMobileNavigation(): void {
    // Helper method to close sidebar when navigating on mobile
    if (this.isMobile()) {
      this.closeSidebar();
    }
  }

  toggleSidebar(): void {
    const currentState = this.isOpenSubject.value;
    this.isOpenSubject.next(!currentState);
    
    if (!currentState) {
      document.documentElement.classList.add('nav-open');
      this.addBodyClickHandler();
    } else {
      document.documentElement.classList.remove('nav-open');
      this.removeBodyClickHandler();
    }
  }

  closeSidebar(): void {
    this.isOpenSubject.next(false);
    document.documentElement.classList.remove('nav-open');
    this.removeBodyClickHandler();
  }

  private addBodyClickHandler(): void {
    // Only add overlay on mobile devices
    if (!this.isMobile()) {
      return;
    }

    const bodyClick = document.createElement('div');
    bodyClick.id = 'bodyClick';
    bodyClick.style.position = 'fixed';
    bodyClick.style.top = '0';
    bodyClick.style.left = '0';
    bodyClick.style.width = '100%';
    bodyClick.style.height = '100%';
    bodyClick.style.zIndex = '999';
    bodyClick.style.backgroundColor = 'rgba(0,0,0,0.3)';
    bodyClick.style.opacity = '0';
    bodyClick.style.transition = 'opacity 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)';
    
    bodyClick.addEventListener('click', () => {
      this.closeSidebar();
    });

    document.body.appendChild(bodyClick);
    
    setTimeout(() => {
      bodyClick.style.opacity = '1';
    }, 10);
  }

  private removeBodyClickHandler(): void {
    const bodyClick = document.getElementById('bodyClick');
    if (bodyClick) {
      bodyClick.style.opacity = '0';
      setTimeout(() => {
        if (bodyClick.parentNode) {
          bodyClick.parentNode.removeChild(bodyClick);
        }
      }, 330);
    }
  }
}