import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReleaseTaskTemplate, CreateTemplateDto, UpdateTemplateDto } from '../models/release-task-template.model';
import { ReleaseTask } from '../models/release-task.model';

@Injectable({
  providedIn: 'root'
})
export class ReleaseTaskTemplateService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({ 'Authorization': token ? `Bearer ${token}` : '' });
  }

  listTemplates(): Observable<{ templates: ReleaseTaskTemplate[] }> {
    return this.http.get<{ templates: ReleaseTaskTemplate[] }>(
      `${this.baseUrl}/release-task-templates`,
      { headers: this.getAuthHeaders() }
    );
  }

  getTemplate(id: number): Observable<{ template: ReleaseTaskTemplate }> {
    return this.http.get<{ template: ReleaseTaskTemplate }>(
      `${this.baseUrl}/release-task-templates/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  createTemplate(data: CreateTemplateDto): Observable<{ template: ReleaseTaskTemplate }> {
    return this.http.post<{ template: ReleaseTaskTemplate }>(
      `${this.baseUrl}/release-task-templates`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  updateTemplate(id: number, data: UpdateTemplateDto): Observable<{ template: ReleaseTaskTemplate }> {
    return this.http.put<{ template: ReleaseTaskTemplate }>(
      `${this.baseUrl}/release-task-templates/${id}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  deleteTemplate(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.baseUrl}/release-task-templates/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  hideTemplate(id: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.baseUrl}/release-task-templates/${id}/hide`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  unhideTemplate(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.baseUrl}/release-task-templates/${id}/hide`,
      { headers: this.getAuthHeaders() }
    );
  }

  applyTemplate(releaseId: number, templateId: number): Observable<{ tasks: ReleaseTask[] }> {
    return this.http.post<{ tasks: ReleaseTask[] }>(
      `${this.baseUrl}/releases/${releaseId}/tasks/apply-template`,
      { template_id: templateId },
      { headers: this.getAuthHeaders() }
    );
  }
}
