export type Priority = 'p1' | 'p2' | 'p3' | 'p4'; // p1: 高(红), p2: 中(黄), p3: 低(蓝), p4: 无(灰)

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  desc?: string;
  completed: boolean;
  priority: Priority;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  listId: string; // 'inbox' or custom list ID
  tags: string[];
  subtasks: SubTask[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  reminder?: string;
  pinned?: boolean; // 是否置顶
}

export interface TaskList {
  id: string;
  name: string;
  color: string;
  icon?: string;
  folderId?: string;
}

export type ViewCategory = 
  | 'inbox' 
  | 'today' 
  | 'upcoming' 
  | 'calendar' 
  | 'daily-report'
  | 'weekly-report'
  | 'list' 
  | 'tag' 
  | 'trash';

export type CalendarViewMode = 'month' | 'week' | 'day';
