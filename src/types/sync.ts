export type SyncStatus = 'idle' | 'syncing' | 'connected' | 'error' | 'disconnected';

export interface SyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  enabled: boolean;
  lastSyncedAt?: string | null;
}

export interface RemoteTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: string;
  due_date?: string | null;
  due_time?: string | null;
  list_id: string;
  tags: string[];
  subtasks: any[];
  pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  reminder?: string | null;
}

export interface RemoteTaskList {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  folder_id?: string | null;
  is_deleted: boolean;
  updated_at: string;
}

export interface RemoteTagRule {
  tag: string;
  keywords: string[];
  enabled: boolean;
  updated_at: string;
}
