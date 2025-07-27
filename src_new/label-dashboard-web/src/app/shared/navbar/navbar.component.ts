import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  userFirstName: string = 'User';
  isAdmin: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.userFirstName = currentUser.first_name || 'User';
      this.isAdmin = currentUser.is_admin || false;
    } else {
      // Fallback to localStorage if auth service doesn't have user data
      const userData = localStorage.getItem('user_data');
      if (userData) {
        const user = JSON.parse(userData);
        this.userFirstName = user.first_name || 'User';
        this.isAdmin = user.is_admin || false;
      }
    }

    // Also check via auth service method as fallback
    if (!this.isAdmin) {
      this.isAdmin = this.authService.isAdmin();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleSidebar(): void {
    this.sidebarService.toggleSidebar();
  }
}
