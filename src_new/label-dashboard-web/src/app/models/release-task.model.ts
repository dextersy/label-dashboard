export type ReleaseTaskStatus = 'not_started' | 'in_progress' | 'done';

export interface ReleaseTask {
  id: number;
  release_id: number;
  brand_id: number;
  title: string;
  notes?: string;
  due_date?: string | null;
  assigned_user_id?: number | null;
  assignedUser?: { id: number; first_name: string; last_name: string; email_address: string } | null;
  createdByUser?: { id: number; first_name: string; last_name: string } | null;
  status: ReleaseTaskStatus;
  created_by_user_id: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignableUser {
  id: number;
  first_name: string;
  last_name: string;
  email_address: string;
  role: 'admin' | 'team_member';
}

export interface CreateReleaseTaskDto {
  title: string;
  notes?: string;
  due_date?: string | null;
  assigned_user_id?: number | null;
}

export interface UpdateReleaseTaskDto {
  title?: string;
  notes?: string | null;
  due_date?: string | null;
  assigned_user_id?: number | null;
  status?: ReleaseTaskStatus;
}
