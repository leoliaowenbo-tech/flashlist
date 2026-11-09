import { Task, TaskList, Priority, SubTask } from '../types';
import { subMonths, isAfter, parseISO, isValid } from 'date-fns';

export interface ImportSummary {
  totalParsed: number;
  recentCount: number;
  listsCount: number;
  tagsCount: number;
  tasks: Task[];
  lists: TaskList[];
}

/**
 * 解析滴答清单 (TickTick) 官方导出的 CSV 文件
 * 支持字段：
 * Folder Name,List Name,Title,Tags,Content,Start Date,Due Date,Reminder,Repeat,Priority,Status,Created Time,Completed Time,Order
 */
export function parseTickTickCSV(csvText: string, monthsLimit: number = 2): ImportSummary {
  const lines = parseCSVLines(csvText);
  if (lines.length < 2) {
    throw new Error('CSV 文件内容为空或格式不正确');
  }

  const header = lines[0].map(h => h.trim().toLowerCase());
  
  const getCol = (row: string[], colName: string): string => {
    const idx = header.findIndex(h => h.includes(colName.toLowerCase()));
    return idx !== -1 && idx < row.length ? row[idx].trim() : '';
  };

  const cutoffDate = subMonths(new Date(), monthsLimit); // 2个月前的基准日期
  const newListsMap = new Map<string, TaskList>();
  const parsedTasks: Task[] = [];
  const allTagsSet = new Set<string>();

  const listColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];
  let colorIdx = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

    const title = getCol(row, 'title');
    if (!title) continue;

    const listName = getCol(row, 'list name') || '收集箱';
    const rawTags = getCol(row, 'tags');
    const rawContent = getCol(row, 'content');
    const rawDueDate = getCol(row, 'due date');
    const rawPriority = getCol(row, 'priority');
    const rawStatus = getCol(row, 'status');
    const rawCreatedTime = getCol(row, 'created time');
    const rawCompletedTime = getCol(row, 'completed time');

    // 解析清单
    let listId = 'inbox';
    if (listName && listName !== '收集箱' && listName !== 'Inbox') {
      listId = `list_${listName}`;
      if (!newListsMap.has(listId)) {
        newListsMap.set(listId, {
          id: listId,
          name: listName,
          color: listColors[colorIdx % listColors.length],
        });
        colorIdx++;
      }
    }

    // 解析优先级 (滴答清单标准：5->高, 3->中, 1->低, 0->无)
    let priority: Priority = 'p4';
    if (rawPriority === '5' || rawPriority.includes('高') || rawPriority.toLowerCase() === 'high') priority = 'p1';
    else if (rawPriority === '3' || rawPriority.includes('中') || rawPriority.toLowerCase() === 'medium') priority = 'p2';
    else if (rawPriority === '1' || rawPriority.includes('低') || rawPriority.toLowerCase() === 'low') priority = 'p3';

    // 解析状态 (0: 未完成, 1: 已完成, 2: 放弃)
    const completed = rawStatus === '1' || rawStatus.includes('完成') || rawStatus.toLowerCase() === 'completed';

    // 解析截止日期与时间
    let dueDate: string | undefined = undefined;
    let dueTime: string | undefined = undefined;
    let targetCompareDate: Date | null = null;

    if (rawDueDate) {
      try {
        const d = new Date(rawDueDate);
        if (isValid(d)) {
          targetCompareDate = d;
          dueDate = d.toISOString().split('T')[0];
          const hours = d.getHours().toString().padStart(2, '0');
          const mins = d.getMinutes().toString().padStart(2, '0');
          if (hours !== '00' || mins !== '00') {
            dueTime = `${hours}:${mins}`;
          }
        }
      } catch (e) {
        // fallback regex match YYYY-MM-DD
        const match = rawDueDate.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/);
        if (match) {
          dueDate = match[1];
          dueTime = match[2];
        }
      }
    }

    // 解析创建时间
    let createdAt = new Date().toISOString();
    if (rawCreatedTime) {
      const cd = new Date(rawCreatedTime);
      if (isValid(cd)) {
        createdAt = cd.toISOString();
        if (!targetCompareDate) targetCompareDate = cd;
      }
    }

    // 过滤近2个月的已知任务：
    // 条件：未完成任务一律保留；对于已完成的任务，要求截止日期或创建时间在近两个月内
    if (completed && targetCompareDate) {
      if (!isAfter(targetCompareDate, cutoffDate)) {
        continue; // 超过两个月的已完成历史任务跳过
      }
    }

    // 解析标签
    const tags = rawTags
      ? rawTags.split(/[,，\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean)
      : [];
    tags.forEach(t => allTagsSet.add(t));

    // 解析子任务 (滴答清单在 Content 中使用 - [ ] 或 - [x] 记录子任务)
    const subtasks: SubTask[] = [];
    const contentLines = rawContent.split(/\r?\n/);
    const remainingDescLines: string[] = [];

    contentLines.forEach((line) => {
      const subMatch = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/);
      if (subMatch) {
        subtasks.push({
          id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          completed: subMatch[1].toLowerCase() === 'x',
          title: subMatch[2].trim(),
        });
      } else {
        remainingDescLines.push(line);
      }
    });

    const desc = remainingDescLines.join('\n').trim();

    parsedTasks.push({
      id: `tick_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      desc,
      completed,
      priority,
      dueDate,
      dueTime,
      listId,
      tags,
      subtasks,
      createdAt,
      updatedAt: new Date().toISOString(),
      completedAt: completed ? (rawCompletedTime || new Date().toISOString()) : undefined,
    });
  }

  return {
    totalParsed: lines.length - 1,
    recentCount: parsedTasks.length,
    listsCount: newListsMap.size,
    tagsCount: allTagsSet.size,
    tasks: parsedTasks,
    lists: Array.from(newListsMap.values()),
  };
}

/**
 * 标准 CSV 拆分函数，支持双引号包裹换行和逗号
 */
function parseCSVLines(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      row.push(field);
      if (row.some(f => f.trim().length > 0)) {
        result.push(row);
      }
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    result.push(row);
  }

  return result;
}
