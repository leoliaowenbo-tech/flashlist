import { getSupabaseClient, getSupabaseConfig, saveSupabaseConfig } from './supabase';
import { Task, TaskList, Priority } from '../types';
import { RemoteTask, RemoteTaskList, RemoteTagRule, SyncStatus } from '../types/sync';
import { TagRule, getTagRules, saveTagRules } from '../utils/tagRecognizer';

export type SyncChangeCallback = {
  onRemoteTaskUpsert?: (task: Task) => void;
  onRemoteTaskDelete?: (taskId: string) => void;
  onRemoteListUpsert?: (list: TaskList) => void;
  onRemoteListDelete?: (listId: string) => void;
  onRemoteTagRules?: (rules: TagRule[]) => void;
  onStatusChange?: (status: SyncStatus, errorMsg?: string) => void;
};

// 任务本地与远端格式转换
export function localToRemoteTask(t: Task, isDeleted = false): RemoteTask {
  return {
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

export function localToRemoteList(l: TaskList, isDeleted = false): RemoteTaskList {
  return {
    id: l.id,
    name: l.name,
    color: l.color || '#3B82F6',
    icon: l.icon || null,
    folder_id: l.folderId || null,
    is_deleted: isDeleted,
    updated_at: new Date().toISOString(),
  };
}

export function remoteToLocalList(r: RemoteTaskList): TaskList {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon || undefined,
    folderId: r.folder_id || undefined,
  };
}

class SyncManager {
  private status: SyncStatus = 'idle';
  private callbacks: SyncChangeCallback = {};
  private realtimeChannel: any = null;
  private isSyncing = false;

  public setCallbacks(callbacks: SyncChangeCallback) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(newStatus: SyncStatus, errorMsg?: string) {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus, errorMsg);
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

    if (this.realtimeChannel) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch (e) { /* ignore */ }
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
              this.callbacks.onRemoteTaskDelete?.(taskId);
            }
          } else if (newRow) {
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
              this.callbacks.onRemoteListDelete?.(listId);
            }
          } else if (newRow) {
            const list = remoteToLocalList(newRow);
            this.callbacks.onRemoteListUpsert?.(list);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tag_rules' },
        async () => {
          // 重新拉取规则
          await this.pullTagRules();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.setStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          this.setStatus('error', '实时连接中断，将自动尝试重连');
        }
      });

    this.realtimeChannel = channel;
  }

  /**
   * 双向全量与差异同步
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

    if (this.isSyncing) {
      return { mergedTasks: localTasks, mergedLists: localLists };
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    try {
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

      // 处理本地分类
      for (const [id, localList] of localListMap.entries()) {
        const remote = remoteListMap.get(id);
        if (!remote) {
          listsToPush.push(localToRemoteList(localList));
          mergedListMap.set(id, localList);
        } else if (remote.is_deleted) {
          // 远端已删除
        } else {
          mergedListMap.set(id, localList);
        }
      }

      // 处理远端新增分类
      for (const [id, remoteList] of remoteListMap.entries()) {
        if (!remoteList.is_deleted && !localListMap.has(id)) {
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
          // 远端没有，本地推上去
          tasksToPush.push(localToRemoteTask(localTask));
          mergedTaskMap.set(id, localTask);
        } else if (remote.is_deleted) {
          // 远端标记已删除，本地同步移除
        } else {
          // 两边都有，比较时间戳：最新者胜
          const localTime = new Date(localTask.updatedAt || 0).getTime();
          const remoteTime = new Date(remote.updated_at || 0).getTime();

          if (remoteTime > localTime) {
            mergedTaskMap.set(id, remoteToLocalTask(remote));
          } else if (localTime > remoteTime) {
            tasksToPush.push(localToRemoteTask(localTask));
            mergedTaskMap.set(id, localTask);
          } else {
            mergedTaskMap.set(id, localTask);
          }
        }
      }

      // 远端有但本地没有的任务，纳入本地
      for (const [id, remoteTask] of remoteTaskMap.entries()) {
        if (!remoteTask.is_deleted && !localTaskMap.has(id)) {
          mergedTaskMap.set(id, remoteToLocalTask(remoteTask));
        }
      }

      if (tasksToPush.length > 0) {
        // 分批上传，每次最多 100 条
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
   * 推送单条任务更新/新增
   */
  public async pushTask(task: Task) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const remote = localToRemoteTask(task);
      await supabase.from('tasks').upsert([remote]);
    } catch (e) {
      console.error('推单任务失败:', e);
    }
  }

  /**
   * 软删除远端任务
   */
  public async deleteTask(taskId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      await supabase
        .from('tasks')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', taskId);
    } catch (e) {
      console.error('删除远端任务失败:', e);
    }
  }

  /**
   * 推送分类更新/新增
   */
  public async pushList(list: TaskList) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const remote = localToRemoteList(list);
      await supabase.from('task_lists').upsert([remote]);
    } catch (e) {
      console.error('推送分类失败:', e);
    }
  }

  /**
   * 软删除远端分类
   */
  public async deleteList(listId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      await supabase
        .from('task_lists')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', listId);
    } catch (e) {
      console.error('删除远端分类失败:', e);
    }
  }

  /**
   * 同步打标规则
   */
  public async syncTagRules() {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const localRules = getTagRules();
      const { data: remoteData } = await supabase.from('tag_rules').select('*');

      if (!remoteData || remoteData.length === 0) {
        // 远端为空，将本地规则推上去
        const toPush = localRules.map((r) => ({
          tag: r.tag,
          keywords: r.keywords,
          enabled: r.enabled,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('tag_rules').upsert(toPush);
      } else {
        // 远端有规则，更新本地
        const remoteRules: TagRule[] = remoteData.map((r: RemoteTagRule) => ({
          tag: r.tag,
          keywords: Array.isArray(r.keywords) ? r.keywords : [],
          enabled: r.enabled,
        }));
        saveTagRules(remoteRules);
        this.callbacks.onRemoteTagRules?.(remoteRules);
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
