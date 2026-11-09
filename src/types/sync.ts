export type SyncStatus = 'idle' | 'syncing' | 'connected' | 'error' | 'disconnected' | 'offline';

export interface SyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  enabled: boolean;
  requireAuth?: boolean;
  userEmail?: string | null;
  lastSyncedAt?: string | null;
}

export interface OutboxMutation {
  id: string;
  type: 'upsert_task' | 'delete_task' | 'upsert_list' | 'delete_list' | 'sync_tag_rules';
  payload: any;
  timestamp: string;
  retryCount?: number;
}

export interface RemoteTask {
  id: string;
  user_id?: string | null;
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
  user_id?: string | null;
  name: string;
  color: string;
  icon?: string | null;
  folder_id?: string | null;
  is_deleted: boolean;
  updated_at: string;
}

export interface RemoteTagRule {
  tag: string;
  user_id?: string | null;
  keywords: string[];
  enabled: boolean;
  updated_at: string;
}
