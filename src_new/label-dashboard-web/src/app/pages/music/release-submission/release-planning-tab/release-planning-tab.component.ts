import { Component, Input, OnInit, OnChanges, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Release } from '../../../../services/release.service';
import { ReleaseTaskService } from '../../../../services/release-task.service';
import { AuthService } from '../../../../services/auth.service';
import { NotificationService } from '../../../../services/notification.service';
import { ConfirmationService } from '../../../../services/confirmation.service';
import { ReleaseTask, AssignableUser, ReleaseTaskStatus } from '../../../../models/release-task.model';
import { IconComponent } from '../../../../components/shared/icon/icon.component';
import { ModalToBodyDirective } from '../../../../directives/modal-to-body.directive';
import { TemplatePickerModalComponent } from './template-picker-modal/template-picker-modal.component';

type FilterMode = 'all' | 'mine' | 'unassigned';

type DueBucket = 'due-now' | 'due-this-week' | 'due-later' | 'no-date';

interface KanbanCell {
  id: string;           // e.g. 'due-now--not-started'
  status: ReleaseTaskStatus;
  bucket: DueBucket;
  tasks: ReleaseTask[];
}

interface KanbanRow {
  bucket: DueBucket;
  label: string;
  cells: KanbanCell[]; // always length 3: not_started, in_progress, done
}

/** @deprecated used only for list view */
interface TaskColumn {
  id: string;
  label: string;
  tasks: ReleaseTask[];
}

/** @deprecated kept for type compat with old drag handler */
interface StatusColumn {
  status: ReleaseTaskStatus;
  id: string;
  label: string;
}

const TASK_SUGGESTIONS = [
  'Announce release date on social media',
  'Pitch on Spotify dashboard',
  'Add Spotify canvas',
  'Send out press release',
  'Schedule pre-save campaign',
  'Submit for playlist consideration',
  'Plan release day social content',
  'Notify fans via email/newsletter',
  'Update bio',
  'Submit to radio stations',
];

@Component({
  selector: 'app-release-planning-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, IconComponent, ModalToBodyDirective, TemplatePickerModalComponent],
  templateUrl: './release-planning-tab.component.html',
  styleUrl: './release-planning-tab.component.scss',
})
export class ReleasePlanningTabComponent implements OnInit, OnChanges {
  @Input() release: Release | null = null;
  @Input() isAdmin = false;

  @ViewChild('boardScroll') private boardScrollRef?: ElementRef<HTMLElement>;
  @ViewChild('boardHeader') private boardHeaderRef?: ElementRef<HTMLElement>;

  tasks: ReleaseTask[] = [];
  assignableUsers: AssignableUser[] = [];
  filterMode: FilterMode = 'all';
  viewMode: 'kanban' | 'list' = 'kanban';
  loading = false;
  suggestionsExpanded = false;
  savingTaskId: number | null = null;
  isDragging = false;
  addingTaskTitle: string | null = null; // suggestion being added

  readonly suggestions = TASK_SUGGESTIONS;

  // New task form
  showNewTaskForm = false;
  newTask = { title: '', notes: '', due_date: '', assigned_user_id: null as number | null };
  savingNew = false;

  // Edit dialog
  editingTask: ReleaseTask | null = null;
  editForm = { title: '', notes: '', due_date: '', assigned_user_id: null as number | null, status: 'not_started' as ReleaseTaskStatus };
  savingEdit = false;

  currentUserId: number | null = null;

  showTemplatePicker = false;

  constructor(
    private taskService: ReleaseTaskService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.currentUserValue?.id ?? null;
    this.loadData();
  }

  ngOnChanges(): void {
    if (this.release) {
      this.loadData();
    }
  }

  private loadData(): void {
    if (!this.release) return;
    this.loading = true;
    this.taskService.getTasks(this.release.id).subscribe({
      next: ({ tasks }) => { this.tasks = tasks; this.loading = false; },
      error: () => { this.loading = false; }
    });
    this.taskService.getAssignableUsers(this.release.id).subscribe({
      next: ({ users }) => { this.assignableUsers = users; },
    });
  }

  // --- Filtering ---

  setFilter(mode: FilterMode): void {
    this.filterMode = mode;
  }

  get filteredTasks(): ReleaseTask[] {
    if (this.filterMode === 'mine') {
      return this.tasks.filter(t => t.assigned_user_id === this.currentUserId);
    }
    if (this.filterMode === 'unassigned') {
      return this.tasks.filter(t => !t.assigned_user_id);
    }
    return this.tasks;
  }

  // --- Kanban 2D grid (rows = due buckets, cols = status) ---

  // All 3 statuses (used for list view counts etc.)
  static readonly STATUS_DEFS: { status: ReleaseTaskStatus; id: string; label: string }[] = [
    { status: 'not_started', id: 'not-started', label: 'Not started' },
    { status: 'in_progress', id: 'in-progress', label: 'In progress' },
    { status: 'done',        id: 'done',         label: 'Done' },
  ];

  // Only the two swim-lane statuses
  static readonly SWIM_STATUS_DEFS: { status: ReleaseTaskStatus; id: string; label: string }[] = [
    { status: 'not_started', id: 'not-started', label: 'Not started' },
    { status: 'in_progress', id: 'in-progress', label: 'In progress' },
  ];

  static readonly BUCKET_DEFS: { bucket: DueBucket; label: string }[] = [
    { bucket: 'due-now',       label: 'Due now' },
    { bucket: 'due-this-week', label: 'Due this week' },
    { bucket: 'due-later',     label: 'Due later' },
    { bucket: 'no-date',       label: 'No date' },
  ];

  get kanbanRows(): KanbanRow[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    const getBucket = (task: ReleaseTask): DueBucket => {
      if (!task.due_date) return 'no-date';
      const d = new Date(task.due_date);
      d.setHours(0, 0, 0, 0);
      if (d <= today) return 'due-now';
      if (d <= weekEnd) return 'due-this-week';
      return 'due-later';
    };

    // Build a map: bucket → swim status → tasks[] (done excluded)
    const map = new Map<DueBucket, Map<ReleaseTaskStatus, ReleaseTask[]>>();
    for (const { bucket } of ReleasePlanningTabComponent.BUCKET_DEFS) {
      const inner = new Map<ReleaseTaskStatus, ReleaseTask[]>();
      for (const { status } of ReleasePlanningTabComponent.SWIM_STATUS_DEFS) {
        inner.set(status, []);
      }
      map.set(bucket, inner);
    }

    for (const task of this.filteredTasks) {
      if (task.status === 'done') continue;
      const bucket = getBucket(task);
      map.get(bucket)!.get(task.status)!.push(task);
    }

    // Sort tasks within each cell by due date
    const sortByDate = (tasks: ReleaseTask[]) =>
      tasks.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });

    const rows: KanbanRow[] = ReleasePlanningTabComponent.BUCKET_DEFS.map(({ bucket, label }) => ({
      bucket,
      label,
      cells: ReleasePlanningTabComponent.SWIM_STATUS_DEFS.map(({ status, id }) => ({
        id: `${bucket}--${id}`,
        status,
        bucket,
        tasks: sortByDate(map.get(bucket)!.get(status)!),
      })),
    }));

    // Hide rows where every cell is empty
    return rows.filter(row => row.cells.some(c => c.tasks.length > 0));
  }

  get doneTasks(): ReleaseTask[] {
    return this.filteredTasks
      .filter(t => t.status === 'done')
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  get doneCellData(): KanbanCell {
    return { id: 'done-column', status: 'done', bucket: 'no-date', tasks: this.doneTasks };
  }

  get swimCellIds(): string[] {
    return ReleasePlanningTabComponent.BUCKET_DEFS.flatMap(({ bucket }) =>
      ReleasePlanningTabComponent.SWIM_STATUS_DEFS.map(({ id }) => `${bucket}--${id}`)
    );
  }

  get allCellIds(): string[] {
    return [...this.swimCellIds, 'done-column'];
  }

  statusCountForCol(status: ReleaseTaskStatus): number {
    return this.filteredTasks.filter(t => t.status === status).length;
  }

  /** @deprecated list view only */
  get columns(): TaskColumn[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    const noDate: ReleaseTask[] = [];
    const dueNow: ReleaseTask[] = [];
    const dueThisWeek: ReleaseTask[] = [];
    const dueLater: ReleaseTask[] = [];

    for (const task of this.filteredTasks) {
      if (!task.due_date) {
        noDate.push(task);
      } else {
        const d = new Date(task.due_date);
        d.setHours(0, 0, 0, 0);
        if (d <= today) {
          dueNow.push(task);
        } else if (d <= weekEnd) {
          dueThisWeek.push(task);
        } else {
          dueLater.push(task);
        }
      }
    }

    return [
      { id: 'due-now', label: 'Due now', tasks: this.sortTasks(dueNow) },
      { id: 'due-this-week', label: 'Due this week', tasks: this.sortTasks(dueThisWeek) },
      { id: 'due-later', label: 'Due later', tasks: this.sortTasks(dueLater) },
      { id: 'no-date', label: 'No date', tasks: this.sortTasks(noDate) },
    ];
  }

  private sortTasks(tasks: ReleaseTask[]): ReleaseTask[] {
    const statusOrder: Record<ReleaseTaskStatus, number> = { in_progress: 0, not_started: 1, done: 2 };
    return [...tasks].sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }

  // --- Drag and drop ---

  onTaskDrop(event: CdkDragDrop<KanbanCell>, targetCell: KanbanCell): void {
    const task: ReleaseTask = event.item.data;
    if (task.status === targetCell.status) return;

    const canChange = this.isAdmin || task.assigned_user_id === this.currentUserId;
    if (!canChange) {
      this.notificationService.showError('Only the assigned person or an admin can change the status.');
      return;
    }

    this.savingTaskId = task.id;
    const idx = this.tasks.findIndex(t => t.id === task.id);
    if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], status: targetCell.status };

    this.taskService.updateTask(this.release!.id, task.id, { status: targetCell.status }).subscribe({
      next: ({ task: updated }) => {
        this.replaceTask(updated);
        this.savingTaskId = null;
        this.cdr.detectChanges();
      },
      error: () => {
        if (idx !== -1) this.tasks[idx] = { ...this.tasks[idx], status: task.status };
        this.notificationService.showError('Failed to update status');
        this.savingTaskId = null;
        this.cdr.detectChanges();
      },
    });
  }

  // --- Suggestions ---

  addSuggestion(title: string): void {
    if (!this.release || this.addingTaskTitle === title) return;
    this.addingTaskTitle = title;
    this.taskService.createTask(this.release.id, { title }).subscribe({
      next: ({ task }) => {
        this.tasks.unshift(task);
        this.addingTaskTitle = null;
        this.cdr.detectChanges();
        this.scrollToNoDateColumn();
      },
      error: () => {
        this.notificationService.showError('Failed to add task');
        this.addingTaskTitle = null;
      },
    });
  }

  syncHeaderScroll(): void {
    const scroll = this.boardScrollRef?.nativeElement;
    const header = this.boardHeaderRef?.nativeElement;
    if (scroll && header) {
      header.scrollLeft = scroll.scrollLeft;
    }
  }

  private scrollToNoDateColumn(): void {
    const scroll = this.boardScrollRef?.nativeElement;
    if (!scroll) return;
    // "No date" is the last column — scroll to the far right
    scroll.scrollTo({ left: scroll.scrollWidth, behavior: 'smooth' });
  }

  // --- New task form ---

  openNewTaskForm(): void {
    this.newTask = { title: '', notes: '', due_date: '', assigned_user_id: null };
    this.showNewTaskForm = true;
  }

  closeNewTaskForm(): void {
    this.showNewTaskForm = false;
  }

  submitNewTask(): void {
    if (!this.release || !this.newTask.title.trim()) return;
    this.savingNew = true;
    this.taskService.createTask(this.release.id, {
      title: this.newTask.title.trim(),
      notes: this.newTask.notes || undefined,
      due_date: this.newTask.due_date || null,
      assigned_user_id: this.newTask.assigned_user_id || null,
    }).subscribe({
      next: ({ task }) => {
        this.tasks.unshift(task);
        this.savingNew = false;
        this.showNewTaskForm = false;
      },
      error: () => {
        this.notificationService.showError('Failed to create task');
        this.savingNew = false;
      },
    });
  }

  // --- Edit dialog ---

  onDragStarted(): void {
    this.isDragging = true;
  }

  openEdit(task: ReleaseTask): void {
    if (this.isDragging) {
      this.isDragging = false;
      return;
    }
    this.editForm = {
      title: task.title,
      notes: task.notes || '',
      due_date: task.due_date || '',
      assigned_user_id: task.assigned_user_id ?? null,
      status: task.status,
    };
    this.editingTask = task;
    this.cdr.detectChanges();
  }

  canEditStatus(): boolean {
    if (!this.editingTask) return false;
    return this.isAdmin || this.editingTask.assigned_user_id === this.currentUserId;
  }

  closeEdit(): void {
    this.editingTask = null;
  }

  submitEdit(): void {
    if (!this.release || !this.editingTask || !this.editForm.title.trim()) return;
    this.savingEdit = true;
    this.taskService.updateTask(this.release.id, this.editingTask.id, {
      title: this.editForm.title.trim(),
      notes: this.editForm.notes || null,
      due_date: this.editForm.due_date || null,
      assigned_user_id: this.editForm.assigned_user_id || null,
      status: this.editForm.status,
    }).subscribe({
      next: ({ task }) => {
        this.replaceTask(task);
        this.savingEdit = false;
        this.editingTask = null;
      },
      error: () => {
        this.notificationService.showError('Failed to save task');
        this.savingEdit = false;
      },
    });
  }

  // --- Status cycling ---

  cycleStatus(task: ReleaseTask, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.release) return;

    const canChange = this.isAdmin || task.assigned_user_id === this.currentUserId;
    if (!canChange) return;

    const next: Record<ReleaseTaskStatus, ReleaseTaskStatus> = {
      not_started: 'in_progress',
      in_progress: 'done',
      done: 'not_started',
    };
    const newStatus = next[task.status];
    this.savingTaskId = task.id;

    this.taskService.updateTask(this.release.id, task.id, { status: newStatus }).subscribe({
      next: ({ task: updated }) => {
        this.replaceTask(updated);
        this.savingTaskId = null;
      },
      error: () => {
        this.notificationService.showError('Failed to update status');
        this.savingTaskId = null;
      },
    });
  }

  // --- Delete ---

  async deleteTask(task: ReleaseTask, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (!this.release) return;

    const confirmed = await this.confirmationService.confirm({
      title: 'Delete task',
      message: `Are you sure you want to delete "${task.title}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!confirmed) return;

    this.taskService.deleteTask(this.release.id, task.id).subscribe({
      next: () => { this.tasks = this.tasks.filter(t => t.id !== task.id); },
      error: () => { this.notificationService.showError('Failed to delete task'); },
    });
  }

  canDelete(task: ReleaseTask): boolean {
    return this.isAdmin || task.created_by_user_id === this.currentUserId;
  }

  // --- Helpers ---

  private replaceTask(updated: ReleaseTask): void {
    const idx = this.tasks.findIndex(t => t.id === updated.id);
    if (idx !== -1) this.tasks[idx] = updated;
  }

  statusLabel(status: ReleaseTaskStatus): string {
    return { not_started: 'Not started', in_progress: 'In progress', done: 'Done' }[status];
  }

  statusIcon(status: ReleaseTaskStatus): string {
    return { not_started: 'circle', in_progress: 'clock', done: 'check-circle' }[status];
  }

  assigneeName(task: ReleaseTask): string {
    const u = task.assignedUser;
    if (!u) return '';
    return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email_address;
  }

  formatDueDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  isDueSoon(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d <= today;
  }

  isAddingSuggestion(title: string): boolean {
    return this.addingTaskTitle === title;
  }

  trackByColId(_: number, col: TaskColumn): string {
    return col.id;
  }

  get statusDefs() { return ReleasePlanningTabComponent.STATUS_DEFS; }
  get swimStatusDefs() { return ReleasePlanningTabComponent.SWIM_STATUS_DEFS; }

  statusCssId(status: ReleaseTaskStatus): string {
    return status.replace(/_/g, '-');
  }

  trackByRowBucket(_: number, row: KanbanRow): string {
    return row.bucket;
  }

  trackByCellId(_: number, cell: KanbanCell): string {
    return cell.id;
  }

  trackByTaskId(_: number, task: ReleaseTask): number {
    return task.id;
  }


  // --- Assignee preview in modals ---

  get editFormAssignee(): AssignableUser | null {
    if (!this.editForm.assigned_user_id) return null;
    return this.assignableUsers.find(u => u.id === this.editForm.assigned_user_id) ?? null;
  }

  get newTaskAssignee(): AssignableUser | null {
    if (!this.newTask.assigned_user_id) return null;
    return this.assignableUsers.find(u => u.id === this.newTask.assigned_user_id) ?? null;
  }

  // --- Avatar helpers ---

  private static readonly AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
  ];

  avatarColor(user: { id: number }): string {
    return ReleasePlanningTabComponent.AVATAR_COLORS[user.id % ReleasePlanningTabComponent.AVATAR_COLORS.length];
  }

  avatarInitials(user: { first_name: string; last_name: string; email_address: string }): string {
    const f = user.first_name?.[0] ?? '';
    const l = user.last_name?.[0] ?? '';
    return (f + l).toUpperCase() || (user.email_address?.[0] ?? '?').toUpperCase();
  }

  get canAssignToSelf(): boolean {
    return !!this.currentUserId && this.assignableUsers.some(u => u.id === this.currentUserId);
  }

  get adminUsers(): AssignableUser[] {
    return this.assignableUsers.filter(u => u.role === 'admin');
  }

  get teamMemberUsers(): AssignableUser[] {
    return this.assignableUsers.filter(u => u.role === 'team_member');
  }

  userDisplayName(u: AssignableUser): string {
    return `${u.first_name} ${u.last_name}`.trim() || u.email_address;
  }

  get todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Template modal handlers
  openTemplatePicker(): void {
    this.showTemplatePicker = true;
  }

  closeTemplatePicker(): void {
    this.showTemplatePicker = false;
  }

  onTemplateApplied(newTasks: ReleaseTask[]): void {
    this.tasks = [...this.tasks, ...newTasks];
    this.showTemplatePicker = false;
  }
}
