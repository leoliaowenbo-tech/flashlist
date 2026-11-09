import { getSupabaseClient, getSupabaseConfig, saveSupabaseConfig, getCurrentUser } from './supabase';
import { Task, TaskList, Priority } from '../types';
import { RemoteTask, RemoteTaskList, RemoteTagRule, SyncStatus, OutboxMutation } from '../types/sync';
import { TagRule, getTagRules, saveTagRules } from '../utils/tagRecognizer';

const STORAGE_KEY_OUTBOX = 'flashlist_sync_outbox';
const STORAGE_KEY_DELETED_IDS = 'flashlist_deleted_ids';

export type SyncChangeCallback = {
  onRemoteTaskUpsert?: (task: Task) => void;
  onRemoteTaskDelete?: (taskId: string) => void;
  onRemoteListUpsert?: (list: TaskList) => void;
  onRemoteListDelete?: (listId: string) => void;
  onRemoteTagRules?: (rules: TagRule[]) => void;
  onStatusChange?: (status: SyncStatus, errorMsg?: string, pendingCount?: number) => void;
};

// 任务本地与远端格式转换
export function localToRemoteTask(t: Task, isDeleted = false, userId?: string | null): RemoteTask {
  const row: RemoteTask = {
    id: t.id,
    title: t.title,
    description: t.desc || '',
    completed: Boolean(t.completed),
    priority: t.priority || 'p4',
    due_date: t.dueDate || null,
    due_time: t.dueTime || null,
    list_id: t.listId || 'inbox',
    tags: t.tags || [],
    subtasks: t.subtasks || [],
    pinned: Boolean(t.pinned),
    is_deleted: isDeleted,
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: t.updatedAt || new Date().toISOString(),
    completed_at: t.completedAt || null,
    reminder: t.reminder || null,
  };
  if (userId) {
    row.user_id = userId;
  }
  return row;
}

export function remoteToLocalTask(r: RemoteTask): Task {
  return {
    id: r.id,
    title: r.title,
    desc: r.description || '',
    completed: Boolean(r.completed),
    priority: (r.priority as Priority) || 'p4',
    dueDate: r.due_date || undefined,
    dueTime: r.due_time || undefined,
    listId: r.list_id || 'inbox',
    tags: Array.isArray(r.tags) ? r.tags : [],
    subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
    pinned: Boolean(r.pinned),
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
    completedAt: r.completed_at || undefined,
    reminder: r.reminder || undefined,
  };
}

export function localToRemoteList(l: TaskList, isDeleted = false, userId?: string | null): RemoteTaskList {
  const row: RemoteTaskList = {
    id: l.id,
    name: l.name,
    color: l.color || '#3B82F6',
    icon: l.icon || null,
    folder_id: l.folderId || null,
    is_deleted: isDeleted,
    updated_at: l.updatedAt || new Date().toISOString(),
  };
  if (userId) {
    row.user_id = userId;
  }
  return row;
}

export function remoteToLocalList(r: RemoteTaskList): TaskList {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon || undefined,
    folderId: r.folder_id || undefined,
    updatedAt: r.updated_at || undefined,
  };
}

class SyncManager {
  private status: SyncStatus = 'idle';
  private callbacks: SyncChangeCallback = {};
  private realtimeChannel: any = null;
  private isSyncing = false;
  private outbox: OutboxMutation[] = [];
  private deletedIds: Set<string> = new Set();

  constructor() {
    this.loadOutbox();
    this.loadDeletedIds();
    this.bindLifecycleEvents();
  }

  private loadOutbox() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_OUTBOX);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.outbox = parsed;
        }
      }
    } catch {
      this.outbox = [];
    }
  }

  private saveOutbox() {
    try {
      localStorage.setItem(STORAGE_KEY_OUTBOX, JSON.stringify(this.outbox));
    } catch {
      // ignore
    }
  }

  private loadDeletedIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DELETED_IDS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.deletedIds = new Set(parsed);
        }
      }
    } catch {
      this.deletedIds = new Set();
    }
  }

  private markDeletedLocally(id: string) {
    this.deletedIds.add(id);
    try {
      localStorage.setItem(
        STORAGE_KEY_DELETED_IDS,
        JSON.stringify(Array.from(this.deletedIds).slice(-500))
      );
    } catch {
      // ignore
    }
  }

  private enqueueOutbox(mutation: OutboxMutation) {
    // 对同一个实体的重复变更进行合并，保留最新一条
    this.outbox = this.outbox.filter(
      (item) => !(item.id === mutation.id && item.type === mutation.type)
    );
    this.outbox.push(mutation);
    this.saveOutbox();
    this.callbacks.onStatusChange?.(this.status, undefined, this.outbox.length);
  }

  public getPendingCount(): number {
    return this.outbox.length;
  }

  private bindLifecycleEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.flushOutbox();
      this.initRealtimeSubscription();
    });

    window.addEventListener('offline', () => {
      const supabase = getSupabaseClient();
      if (supabase) {
        this.setStatus('offline', '当前处于离线模式，修改已安全暂存本地，联网后自动同步');
      }
    });
  }

  public setCallbacks(callbacks: SyncChangeCallback) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(newStatus: SyncStatus, errorMsg?: string) {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus, errorMsg, this.outbox.length);
  }

  /**
   * 冲刷离线变更队列 (Outbox)
   */
  public async flushOutbox(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase || this.outbox.length === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const user = await getCurrentUser();
    const userId = user?.id || null;
    const remaining: OutboxMutation[] = [];

    for (const item of this.outbox) {
      try {
        if (item.type === 'upsert_task') {
          const remote = localToRemoteTask(item.payload as Task, false, userId);
          const { error } = await supabase.from('tasks').upsert([remote]);
          if (error) throw error;
        } else if (item.type === 'delete_task') {
          const { error } = await supabase
            .from('tasks')
            .update({ is_deleted: true, updated_at: item.timestamp })
            .eq('id', item.id);
          if (error) throw error;
        } else if (item.type === 'upsert_list') {
          const remote = localToRemoteList(item.payload as TaskList, false, userId);
          const { error } = await supabase.from('task_lists').upsert([remote]);
          if (error) throw error;
        } else if (item.type === 'delete_list') {
          const { error } = await supabase
            .from('task_lists')
            .update({ is_deleted: true, updated_at: item.timestamp })
            .eq('id', item.id);
          if (error) throw error;
        }
      } catch (e) {
        remaining.push({
          ...item,
          retryCount: (item.retryCount || 0) + 1,
        });
      }
    }

    this.outbox = remaining;
    this.saveOutbox();
    this.callbacks.onStatusChange?.(this.status, undefined, this.outbox.length);
  }

  /**
   * 初始化并启动实时监听
   */
  public initRealtimeSubscription() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      this.setStatus('disconnected');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setStatus('offline', '离线模式，联网后将自动同步');
      return;
    }

    if (this.realtimeChannel) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch (e) {
        /* ignore */
      }
    }

    this.setStatus('connected');

    const channel = supabase.channel('flashlist_realtime_sync');

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          const newRow = payload.new as RemoteTask;
          const oldRow = payload.old as RemoteTask;

          if (payload.eventType === 'DELETE' || (newRow && newRow.is_deleted)) {
            const taskId = newRow?.id || oldRow?.id;
            if (taskId) {
              this.markDeletedLocally(taskId);
              this.callbacks.onRemoteTaskDelete?.(taskId);
            }
          } else if (newRow && !this.deletedIds.has(newRow.id)) {
            const task = remoteToLocalTask(newRow);
            this.callbacks.onRemoteTaskUpsert?.(task);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_lists' },
        (payload) => {
          const newRow = payload.new as RemoteTaskList;
          const oldRow = payload.old as RemoteTaskList;

          if (payload.eventType === 'DELETE' || (newRow && newRow.is_deleted)) {
            const listId = newRow?.id || oldRow?.id;
            if (listId) {
              this.markDeletedLocally(listId);
              this.callbacks.onRemoteListDelete?.(listId);
            }
          } else if (newRow && !this.deletedIds.has(newRow.id)) {
            const list = remoteToLocalList(newRow);
            this.callbacks.onRemoteListUpsert?.(list);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tag_rules' },
        async () => {
          await this.pullTagRules();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.setStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          this.setStatus('error', '实时通道重连中，数据将在后台自动同步');
        }
      });

    this.realtimeChannel = channel;
  }

  /**
   * 双向全量与差异同步（先冲刷离线队列，再双向合并）
   */
  public async performFullSync(
    localTasks: Task[],
    localLists: TaskList[]
  ): Promise<{
    mergedTasks: Task[];
    mergedLists: TaskList[];
  }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { mergedTasks: localTasks, mergedLists: localLists };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setStatus('offline', '当前无网络，已使用本地离线数据');
      return { mergedTasks: localTasks, mergedLists: localLists };
    }

    if (this.isSyncing) {
      return { mergedTasks: localTasks, mergedLists: localLists };
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      // 0. 先冲刷本地离线期间积累的变更队列
      await this.flushOutbox();

      const user = await getCurrentUser();
      const userId = user?.id || null;

      // 1. 同步任务分类清单 (Task Lists)
      const { data: remoteListsData, error: listError } = await supabase
        .from('task_lists')
        .select('*');

      if (listError) throw listError;

      const remoteLists: RemoteTaskList[] = remoteListsData || [];
      const remoteListMap = new Map(remoteLists.map((l) => [l.id, l]));
      const localListMap = new Map(localLists.map((l) => [l.id, l]));

      const listsToPush: RemoteTaskList[] = [];
      const mergedListMap = new Map<string, TaskList>();

      for (const [id, localList] of localListMap.entries()) {
        const remote = remoteListMap.get(id);
        if (!remote) {
          if (!this.deletedIds.has(id)) {
            listsToPush.push(localToRemoteList(localList, false, userId));
            mergedListMap.set(id, localList);
          }
        } else if (remote.is_deleted) {
          this.markDeletedLocally(id);
        } else {
          const localTime = new Date(localList.updatedAt || 0).getTime();
          const remoteTime = new Date(remote.updated_at || 0).getTime();
          if (remoteTime > localTime) {
            mergedListMap.set(id, remoteToLocalList(remote));
          } else {
            if (localTime > remoteTime || (userId && !remote.user_id)) {
              listsToPush.push(localToRemoteList(localList, false, userId));
            }
            mergedListMap.set(id, localList);
          }
        }
      }

      for (const [id, remoteList] of remoteListMap.entries()) {
        if (!remoteList.is_deleted && !localListMap.has(id) && !this.deletedIds.has(id)) {
          mergedListMap.set(id, remoteToLocalList(remoteList));
        }
      }

      if (listsToPush.length > 0) {
        await supabase.from('task_lists').upsert(listsToPush);
      }

      const finalLists = Array.from(mergedListMap.values());

      // 2. 同步任务 (Tasks)
      const { data: remoteTasksData, error: taskError } = await supabase
        .from('tasks')
        .select('*');

      if (taskError) throw taskError;

      const remoteTasks: RemoteTask[] = remoteTasksData || [];
      const remoteTaskMap = new Map(remoteTasks.map((t) => [t.id, t]));
      const localTaskMap = new Map(localTasks.map((t) => [t.id, t]));

      const tasksToPush: RemoteTask[] = [];
      const mergedTaskMap = new Map<string, Task>();

      for (const [id, localTask] of localTaskMap.entries()) {
        const remote = remoteTaskMap.get(id);
        if (!remote) {
          if (!this.deletedIds.has(id)) {
            tasksToPush.push(localToRemoteTask(localTask, false, userId));
            mergedTaskMap.set(id, localTask);
          }
        } else if (remote.is_deleted) {
          this.markDeletedLocally(id);
        } else {
          const localTime = new Date(localTask.updatedAt || 0).getTime();
          const remoteTime = new Date(remote.updated_at || 0).getTime();

          if (remoteTime > localTime) {
            mergedTaskMap.set(id, remoteToLocalTask(remote));
          } else if (localTime > remoteTime || (userId && !remote.user_id)) {
            tasksToPush.push(localToRemoteTask(localTask, false, userId));
            mergedTaskMap.set(id, localTask);
          } else {
            mergedTaskMap.set(id, localTask);
          }
        }
      }

      for (const [id, remoteTask] of remoteTaskMap.entries()) {
        if (!remoteTask.is_deleted && !localTaskMap.has(id) && !this.deletedIds.has(id)) {
          mergedTaskMap.set(id, remoteToLocalTask(remoteTask));
        }
      }

      if (tasksToPush.length > 0) {
        for (let i = 0; i < tasksToPush.length; i += 100) {
          const chunk = tasksToPush.slice(i, i + 100);
          await supabase.from('tasks').upsert(chunk);
        }
      }

      // 3. 同步打标规则
      await this.syncTagRules();

      const finalTasks = Array.from(mergedTaskMap.values());

      const config = getSupabaseConfig();
      config.lastSyncedAt = new Date().toISOString();
      saveSupabaseConfig(config);

      this.setStatus('connected');
      return {
        mergedTasks: finalTasks,
        mergedLists: finalLists,
      };
    } catch (e: any) {
      console.error('全量同步失败:', e);
      this.setStatus('error', e.message || '同步失败');
      return { mergedTasks: localTasks, mergedLists: localLists };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 推送单条任务更新/新增（失败自动进入离线队列）
   */
  public async pushTask(task: Task) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.enqueueOutbox({
        id: task.id,
        type: 'upsert_task',
        payload: task,
        timestamp: task.updatedAt || new Date().toISOString(),
      });
      this.setStatus('offline', '已暂存离线更改');
      return;
    }

    try {
      const user = await getCurrentUser();
      const remote = localToRemoteTask(task, false, user?.id || null);
      const { error } = await supabase.from('tasks').upsert([remote]);
      if (error) throw error;
    } catch (e) {
      console.warn('推送单任务失败，已加入离线重试队列:', e);
      this.enqueueOutbox({
        id: task.id,
        type: 'upsert_task',
        payload: task,
        timestamp: task.updatedAt || new Date().toISOString(),
      });
    }
  }

  /**
   * 软删除远端任务（失败自动进入离线队列）
   */
  public async deleteTask(taskId: string) {
    this.markDeletedLocally(taskId);
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const now = new Date().toISOString();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.enqueueOutbox({
        id: taskId,
        type: 'delete_task',
        payload: { id: taskId },
        timestamp: now,
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_deleted: true, updated_at: now })
        .eq('id', taskId);
      if (error) throw error;
    } catch (e) {
      console.warn('删除远端任务失败，已加入离线重试队列:', e);
      this.enqueueOutbox({
        id: taskId,
        type: 'delete_task',
        payload: { id: taskId },
        timestamp: now,
      });
    }
  }

  /**
   * 推送分类更新/新增
   */
  public async pushList(list: TaskList) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.enqueueOutbox({
        id: list.id,
        type: 'upsert_list',
        payload: list,
        timestamp: list.updatedAt || new Date().toISOString(),
      });
      return;
    }

    try {
      const user = await getCurrentUser();
      const remote = localToRemoteList(list, false, user?.id || null);
      const { error } = await supabase.from('task_lists').upsert([remote]);
      if (error) throw error;
    } catch (e) {
      this.enqueueOutbox({
        id: list.id,
        type: 'upsert_list',
        payload: list,
        timestamp: list.updatedAt || new Date().toISOString(),
      });
    }
  }

  /**
   * 软删除远端分类
   */
  public async deleteList(listId: string) {
    this.markDeletedLocally(listId);
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const now = new Date().toISOString();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.enqueueOutbox({
        id: listId,
        type: 'delete_list',
        payload: { id: listId },
        timestamp: now,
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('task_lists')
        .update({ is_deleted: true, updated_at: now })
        .eq('id', listId);
      if (error) throw error;
    } catch (e) {
      this.enqueueOutbox({
        id: listId,
        type: 'delete_list',
        payload: { id: listId },
        timestamp: now,
      });
    }
  }

  /**
   * 同步打标规则
   */
  public async syncTagRules() {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const user = await getCurrentUser();
      const userId = user?.id || null;
      const localRules = getTagRules();
      const { data: remoteData } = await supabase.from('tag_rules').select('*');

      if (!remoteData || remoteData.length === 0) {
        const toPush = localRules.map((r) => {
          const item: RemoteTagRule = {
            tag: r.tag,
            keywords: r.keywords,
            enabled: r.enabled,
            updated_at: new Date().toISOString(),
          };
          if (userId) item.user_id = userId;
          return item;
        });
        await supabase.from('tag_rules').upsert(toPush);
      } else {
        const remoteMap = new Map(remoteData.map((r: RemoteTagRule) => [r.tag, r]));
        const mergedRules: TagRule[] = [];
        const rulesToPush: RemoteTagRule[] = [];

        for (const r of remoteData as RemoteTagRule[]) {
          mergedRules.push({
            tag: r.tag,
            keywords: Array.isArray(r.keywords) ? r.keywords : [],
            enabled: r.enabled,
          });
        }

        for (const localRule of localRules) {
          if (!remoteMap.has(localRule.tag)) {
            mergedRules.push(localRule);
            const item: RemoteTagRule = {
              tag: localRule.tag,
              keywords: localRule.keywords,
              enabled: localRule.enabled,
              updated_at: new Date().toISOString(),
            };
            if (userId) item.user_id = userId;
            rulesToPush.push(item);
          }
        }

        if (rulesToPush.length > 0) {
          await supabase.from('tag_rules').upsert(rulesToPush);
        }

        saveTagRules(mergedRules);
        this.callbacks.onRemoteTagRules?.(mergedRules);
      }
    } catch (e) {
      console.error('同步规则失败:', e);
    }
  }

  private async pullTagRules() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { data: remoteData } = await supabase.from('tag_rules').select('*');
      if (remoteData) {
        const remoteRules: TagRule[] = remoteData.map((r: RemoteTagRule) => ({
          tag: r.tag,
          keywords: Array.isArray(r.keywords) ? r.keywords : [],
          enabled: r.enabled,
        }));
        saveTagRules(remoteRules);
        this.callbacks.onRemoteTagRules?.(remoteRules);
      }
    } catch (e) {
      console.error('拉取规则失败:', e);
    }
  }
}

export const syncManager = new SyncManager();
