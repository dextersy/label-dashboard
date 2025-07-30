import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-child-brands-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './child-brands-tab.component.html'
})
export class ChildBrandsTabComponent {
  constructor() {}
}