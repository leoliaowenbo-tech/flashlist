import { useState, useEffect, useCallback, useRef } from 'react';
import { Task, TaskList, ViewCategory, Priority } from '../types';
import { SyncStatus } from '../types/sync';
import { isToday, parseISO, startOfDay, format } from 'date-fns';
import { matchTagsFromText, TagRule, getTagRules, addTagRule, deleteTagRule, renameTagRule } from '../utils/tagRecognizer';
import { syncManager } from '../services/syncService';
import { getSupabaseConfig } from '../services/supabase';
import { playTaskCompleteSound, soundManager } from '../utils/sound';

const STORAGE_KEY_TASKS = 'ticktick_clone_tasks';
const STORAGE_KEY_LISTS = 'ticktick_clone_lists';
const STORAGE_KEY_CUSTOM_TAGS = 'ticktick_clone_custom_tags';

const INITIAL_LISTS: TaskList[] = [
  { id: 'work', name: '工作项目', color: '#3B82F6' },
  { id: 'demand', name: '需求', color: '#F59E0B' },
  { id: 'life', name: '生活日常', color: '#10B981' },
  { id: 'learning', name: '技能进阶', color: '#8B5CF6' },
];

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TASKS);
    if (saved) {
      try {
        const raw: Task[] = JSON.parse(saved);
        return raw.map((t) => {
          let updatedListId = t.listId;
          if (t.title && t.title.includes('需求')) {
            updatedListId = 'demand';
          }

          const matched = matchTagsFromText(t.title).map((m) => m.tag);
          const mergedTags =
            matched.length > 0
              ? Array.from(new Set([...(t.tags || []), ...matched]))
              : t.tags;

          return {
            ...t,
            listId: updatedListId,
            tags: mergedTags,
          };
        });
      } catch (e) {
        /* ignore */
      }
    }
    return [];
  });

  const [lists, setLists] = useState<TaskList[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LISTS);
    if (saved) {
      try {
        const parsed: TaskList[] = JSON.parse(saved);
        const hasDemand = parsed.some(
          (l) => l.name === '需求' || l.id === 'demand'
        );
        if (!hasDemand) {
          const demandList: TaskList = {
            id: 'demand',
            name: '需求',
            color: '#F59E0B',
          };
          return [...parsed, demandList];
        }
        return parsed;
      } catch (e) {
        /* ignore */
      }
    }
    return INITIAL_LISTS;
  });

  const [currentView, setCurrentView] = useState<ViewCategory>('today');
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [currentTag, setCurrentTag] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 同步状态管理
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    syncManager.getStatus()
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    syncManager.getPendingCount()
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return getSupabaseConfig().lastSyncedAt || null;
  });

  const [customTags, setCustomTags] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_TAGS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        /* ignore */
      }
    }
    return [];
  });

  // 持久化存储到本地 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LISTS, JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CUSTOM_TAGS, JSON.stringify(customTags));
  }, [customTags]);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const listsRef = useRef(lists);
  listsRef.current = lists;

  // 初始化 Supabase 实时监听与双向同步
  useEffect(() => {
    syncManager.setCallbacks({
      onRemoteTaskUpsert: (remoteTask: Task) => {
        setTasks((prev) => {
          const existingIdx = prev.findIndex((t) => t.id === remoteTask.id);
          if (existingIdx >= 0) {
            const existing = prev[existingIdx];
            const localTime = new Date(existing.updatedAt || 0).getTime();
            const remoteTime = new Date(remoteTask.updatedAt || 0).getTime();
            if (remoteTime >= localTime) {
              const updated = [...prev];
              updated[existingIdx] = remoteTask;
              return updated;
            }
            return prev;
          } else {
            return [remoteTask, ...prev];
          }
        });
      },
      onRemoteTaskDelete: (taskId: string) => {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        setSelectedTaskId((prevSelected) =>
          prevSelected === taskId ? null : prevSelected
        );
      },
      onRemoteListUpsert: (remoteList: TaskList) => {
        setLists((prev) => {
          const existingIdx = prev.findIndex((l) => l.id === remoteList.id);
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = remoteList;
            return updated;
          }
          return [...prev, remoteList];
        });
      },
      onRemoteListDelete: (listId: string) => {
        setLists((prev) => prev.filter((l) => l.id !== listId));
        setTasks((prev) =>
          prev.map((t) => (t.listId === listId ? { ...t, listId: 'inbox' } : t))
        );
      },
      onStatusChange: (status: SyncStatus, errorMsg?: string, pendingCount?: number) => {
        setSyncStatus(status);
        setSyncError(errorMsg || null);
        if (typeof pendingCount === 'number') {
          setPendingSyncCount(pendingCount);
        }
        if (status === 'connected') {
          setLastSyncedAt(new Date().toISOString());
        }
      },
    });

    const runAutoSync = () => {
      const cfg = getSupabaseConfig();
      if (cfg.enabled && cfg.supabaseUrl && cfg.supabaseAnonKey) {
        syncManager.initRealtimeSubscription();
        syncManager
          .performFullSync(tasksRef.current, listsRef.current)
          .then(({ mergedTasks, mergedLists }) => {
            setTasks(mergedTasks);
            setLists(mergedLists);
            setLastSyncedAt(new Date().toISOString());
          });
      } else {
        setSyncStatus('disconnected');
      }
    };

    runAutoSync();

    // 当手机从后台切回前台或网络恢复时，自动触发双向增量/全量同步
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runAutoSync();
      }
    };
    const handleOnline = () => {
      runAutoSync();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // 手动触发全量同步
  const triggerSync = useCallback(async () => {
    const config = getSupabaseConfig();
    if (!config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
      setSyncStatus('disconnected');
      return;
    }
    const { mergedTasks, mergedLists } = await syncManager.performFullSync(
      tasksRef.current,
      listsRef.current
    );
    setTasks(mergedTasks);
    setLists(mergedLists);
    setLastSyncedAt(new Date().toISOString());
  }, []);

  // 获取所有标签：任务中的标签、规则中配置的标签、以及用户自定义创建的标签
  const allTags = Array.from(
    new Set([
      ...customTags,
      ...getTagRules().map((r) => r.tag),
      ...tasks.flatMap((t) => t.tags).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

  const addTag = (tagName: string, keywords?: string[]) => {
    const clean = tagName.trim().replace(/^#/, '');
    if (!clean) return;
    setCustomTags((prev) => {
      if (!prev.includes(clean)) {
        return [...prev, clean];
      }
      return prev;
    });

    if (keywords && keywords.length > 0) {
      addTagRule(clean, keywords);
    }
  };

  const deleteTag = (tagName: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tagName));
    deleteTagRule(tagName);
    setTasks((prev) =>
      prev.map((t) => {
        if (!t.tags.includes(tagName)) return t;
        const updatedTags = t.tags.filter((tag) => tag !== tagName);
        const updated = {
          ...t,
          tags: updatedTags,
          updatedAt: new Date().toISOString(),
        };
        syncManager.pushTask(updated);
        return updated;
      })
    );
    if (currentView === 'tag' && currentTag === tagName) {
      setCurrentView('today');
      setCurrentTag(null);
    }
  };

  const renameTag = (oldName: string, newName: string) => {
    const cleanNew = newName.trim().replace(/^#/, '');
    if (!cleanNew || cleanNew === oldName) return;

    setCustomTags((prev) =>
      prev.map((t) => (t === oldName ? cleanNew : t))
    );
    renameTagRule(oldName, cleanNew);
    setTasks((prev) =>
      prev.map((t) => {
        if (!t.tags.includes(oldName)) return t;
        const updatedTags = t.tags.map((tag) => (tag === oldName ? cleanNew : tag));
        const updated = {
          ...t,
          tags: updatedTags,
          updatedAt: new Date().toISOString(),
        };
        syncManager.pushTask(updated);
        return updated;
      })
    );
    if (currentView === 'tag' && currentTag === oldName) {
      setCurrentTag(cleanNew);
    }
  };

  const addTask = (taskData: Partial<Task> & { title: string }) => {
    const autoMatched = matchTagsFromText(taskData.title).map((m) => m.tag);
    const initialTags =
      taskData.tags || (currentView === 'tag' && currentTag ? [currentTag] : []);
    const combinedTags = Array.from(new Set([...initialTags, ...autoMatched]));

    let targetListId =
      taskData.listId ||
      (currentView === 'list' && currentListId ? currentListId : 'inbox');
    if (taskData.title.includes('需求') && targetListId === 'inbox') {
      targetListId = 'demand';
    }

    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: taskData.title,
      desc: taskData.desc || '',
      completed: false,
      priority: taskData.priority || 'p4',
      dueDate: taskData.dueDate || format(new Date(), 'yyyy-MM-dd'),
      dueTime: taskData.dueTime,
      listId: targetListId,
      tags: combinedTags,
      subtasks: taskData.subtasks || [],
      pinned: taskData.pinned || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setSelectedTaskId(newTask.id);
    }

    // 异步推送到云端
    syncManager.pushTask(newTask);

    return newTask;
  };

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => soundManager.isEnabled());

  const toggleSound = () => {
    const next = soundManager.toggle();
    setSoundEnabledState(next);
    return next;
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    let updatedTaskObj: Task | null = null;
    let justCompleted = false;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          if (updates.completed === true && !t.completed) {
            justCompleted = true;
          }
          let updatedTags = updates.tags !== undefined ? updates.tags : t.tags;
          if (updates.title && updates.title !== t.title) {
            const newAutoMatched = matchTagsFromText(updates.title).map((m) => m.tag);
            updatedTags = Array.from(
              new Set([...(updatedTags || []), ...newAutoMatched])
            );
          }

          const updated: Task = {
            ...t,
            ...updates,
            tags: updatedTags,
            updatedAt: new Date().toISOString(),
          };
          if (updates.completed !== undefined) {
            updated.completedAt = updates.completed
              ? new Date().toISOString()
              : undefined;
          }
          updatedTaskObj = updated;
          return updated;
        }
        return t;
      })
    );

    if (justCompleted) {
      playTaskCompleteSound();
    }

    if (updatedTaskObj) {
      syncManager.pushTask(updatedTaskObj);
    }
  };

  const autoTagAllTasks = () => {
    setTasks((prev) => {
      const updatedList = prev.map((task) => {
        const matched = matchTagsFromText(task.title).map((m) => m.tag);
        if (matched.length > 0) {
          const merged = Array.from(new Set([...(task.tags || []), ...matched]));
          const updated = {
            ...task,
            tags: merged,
            updatedAt: new Date().toISOString(),
          };
          syncManager.pushTask(updated);
          return updated;
        }
        return task;
      });
      return updatedList;
    });
  };

  const toggleTaskCompletion = (id: string) => {
    let updatedTaskObj: Task | null = null;
    let justCompleted = false;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextCompleted = !t.completed;
          if (nextCompleted) {
            justCompleted = true;
          }
          const updated: Task = {
            ...t,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString(),
          };
          updatedTaskObj = updated;
          return updated;
        }
        return t;
      })
    );

    if (justCompleted) {
      playTaskCompleteSound();
    }

    if (updatedTaskObj) {
      syncManager.pushTask(updatedTaskObj);
    }
  };

  const toggleTaskPin = (id: string) => {
    let updatedTaskObj: Task | null = null;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated: Task = {
            ...t,
            pinned: !t.pinned,
            updatedAt: new Date().toISOString(),
          };
          updatedTaskObj = updated;
          return updated;
        }
        return t;
      })
    );

    if (updatedTaskObj) {
      syncManager.pushTask(updatedTaskObj);
    }
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTaskId === id) {
      setSelectedTaskId(null);
    }
    syncManager.deleteTask(id);
  };

  const addList = (name: string, color: string = '#3B82F6') => {
    const newList: TaskList = {
      id: `list_${Date.now()}`,
      name,
      color,
      updatedAt: new Date().toISOString(),
    };
    setLists((prev) => [...prev, newList]);
    syncManager.pushList(newList);
    return newList;
  };

  const updateList = (listId: string, updates: Partial<TaskList>) => {
    let updatedListObj: TaskList | null = null;
    setLists((prev) =>
      prev.map((l) => {
        if (l.id === listId) {
          const updated = { ...l, ...updates, updatedAt: new Date().toISOString() };
          updatedListObj = updated;
          return updated;
        }
        return l;
      })
    );
    if (updatedListObj) {
      syncManager.pushList(updatedListObj);
    }
  };

  const deleteList = (listId: string) => {
    setLists((prev) => prev.filter((l) => l.id !== listId));
    setTasks((prev) =>
      prev.map((t) => (t.listId === listId ? { ...t, listId: 'inbox' } : t))
    );
    if (currentListId === listId) {
      setCurrentView('inbox');
      setCurrentListId(null);
    }
    syncManager.deleteList(listId);
  };

  const filteredTasks = tasks.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        t.title.toLowerCase().includes(q) ||
        (t.desc && t.desc.toLowerCase().includes(q)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (currentView === 'inbox') {
      return t.listId === 'inbox';
    }
    if (currentView === 'today') {
      if (!t.dueDate) return false;
      try {
        const d = parseISO(t.dueDate);
        return isToday(d);
      } catch {
        return false;
      }
    }
    if (currentView === 'upcoming') {
      return Boolean(t.dueDate);
    }
    if (currentView === 'list' && currentListId) {
      return t.listId === currentListId;
    }
    if (currentView === 'tag' && currentTag) {
      return t.tags.includes(currentTag);
    }
    return true;
  });

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  return {
    tasks,
    lists,
    currentView,
    currentListId,
    currentTag,
    selectedTaskId,
    selectedTask,
    searchQuery,
    allTags,
    filteredTasks,
    syncStatus,
    syncError,
    pendingSyncCount,
    lastSyncedAt,
    soundEnabled,
    toggleSound,
    playTaskCompleteSound,
    setCurrentView,
    setCurrentListId,
    setCurrentTag,
    setSelectedTaskId,
    setSearchQuery,
    addTask,
    updateTask,
    autoTagAllTasks,
    toggleTaskCompletion,
    toggleTaskPin,
    deleteTask,
    addList,
    updateList,
    deleteList,
    addTag,
    deleteTag,
    renameTag,
    triggerSync,
  };
}
