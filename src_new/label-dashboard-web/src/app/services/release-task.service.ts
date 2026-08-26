import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReleaseTask, AssignableUser, CreateReleaseTaskDto, UpdateReleaseTaskDto } from '../models/release-task.model';

@Injectable({
  providedIn: 'root'
})
export class ReleaseTaskService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders({ 'Authorization': token ? `Bearer ${token}` : '' });
  }

  getTasks(releaseId: number): Observable<{ tasks: ReleaseTask[] }> {
    return this.http.get<{ tasks: ReleaseTask[] }>(
      `${this.baseUrl}/releases/${releaseId}/tasks`,
      { headers: this.getAuthHeaders() }
    );
  }

  getAssignableUsers(releaseId: number): Observable<{ users: AssignableUser[] }> {
    return this.http.get<{ users: AssignableUser[] }>(
      `${this.baseUrl}/releases/${releaseId}/tasks/assignable-users`,
      { headers: this.getAuthHeaders() }
    );
  }

  createTask(releaseId: number, data: CreateReleaseTaskDto): Observable<{ task: ReleaseTask }> {
    return this.http.post<{ task: ReleaseTask }>(
      `${this.baseUrl}/releases/${releaseId}/tasks`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  updateTask(releaseId: number, taskId: number, data: UpdateReleaseTaskDto): Observable<{ task: ReleaseTask }> {
    return this.http.put<{ task: ReleaseTask }>(
      `${this.baseUrl}/releases/${releaseId}/tasks/${taskId}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  deleteTask(releaseId: number, taskId: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.baseUrl}/releases/${releaseId}/tasks/${taskId}`,
      { headers: this.getAuthHeaders() }
    );
  }
}
