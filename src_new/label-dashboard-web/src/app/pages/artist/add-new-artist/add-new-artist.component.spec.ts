import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddNewArtistComponent } from './add-new-artist.component';

describe('AddNewArtistComponent', () => {
  let component: AddNewArtistComponent;
  let fixture: ComponentFixture<AddNewArtistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddNewArtistComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AddNewArtistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
