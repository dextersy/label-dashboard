import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { BreadcrumbService, BreadcrumbItem } from '../../services/breadcrumb.service';

@Component({
    selector: 'app-breadcrumb',
    imports: [CommonModule, RouterModule],
    templateUrl: './breadcrumb.component.html',
    styleUrl: './breadcrumb.component.scss'
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  breadcrumbs: BreadcrumbItem[] = [];
  private subscription: Subscription = new Subscription();

  constructor(private breadcrumbService: BreadcrumbService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.breadcrumbService.breadcrumbs$.subscribe(breadcrumbs => {
        this.breadcrumbs = breadcrumbs;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}