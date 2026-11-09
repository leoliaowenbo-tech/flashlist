import { Task } from '../types';
import { 
  format, 
  parseISO, 
  isValid, 
  isToday, 
  isSameDay, 
  addDays, 
  subDays, 
  startOfDay, 
  endOfDay 
} from 'date-fns';
import { extractTaskMetadata, rephraseTaskToReportLanguage } from './localReportRephraser';

export type DailyReportFormatStyle = 'standard' | 'markdown';

export interface DailyReportItem {
  id: string;
  title: string;
  rawTitle?: string;
  school?: string;
  course?: string;
  action?: string;
  sourceTaskId?: string;
  type: 'completed' | 'planned'; // 'completed' 今日完成 | 'planned' 明日预计
  isCustom?: boolean;
}

export interface DailyReportOptions {
  enableRephrasing?: boolean;
  withNumbering?: boolean;
  formatStyle?: DailyReportFormatStyle;
}

/**
 * 提取指定日期的“今日完成”和“次日预计”任务
 */
export function extractDailyReportItems(
  tasks: Task[],
  targetDate: Date = new Date(),
  options: { enableRephrasing?: boolean } = {}
): { completedItems: DailyReportItem[]; plannedItems: DailyReportItem[] } {
  const { enableRephrasing = true } = options;
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);
  const targetDateStr = format(targetDate, 'yyyy-MM-dd');

  const tomorrow = addDays(targetDate, 1);
  const tomorrowDateStr = format(tomorrow, 'yyyy-MM-dd');
  const tomorrowStart = startOfDay(tomorrow);
  const tomorrowEnd = endOfDay(tomorrow);

  const completedItems: DailyReportItem[] = [];
  const plannedItems: DailyReportItem[] = [];

  for (const task of tasks) {
    // 1. 今日完成的任务: 已完成，且 (completedAt 在当天 或 无completedAt时dueDate在当天)
    if (task.completed) {
      let isCompletedOnDay = false;
      if (task.completedAt) {
        try {
          const d = parseISO(task.completedAt);
          if (isValid(d) && d >= dayStart && d <= dayEnd) {
            isCompletedOnDay = true;
          }
        } catch {
          /* ignore */
        }
      } else if (task.dueDate === targetDateStr) {
        isCompletedOnDay = true;
      }

      if (isCompletedOnDay) {
        const meta = extractTaskMetadata(task.title, task.desc);
        let title = task.title;
        if (enableRephrasing) {
          title = rephraseTaskToReportLanguage(task.title, 'daily');
        }

        completedItems.push({
          id: `task_comp_${task.id}`,
          sourceTaskId: task.id,
          rawTitle: task.title,
          title,
          school: meta.school,
          course: meta.course,
          action: meta.actionText,
          type: 'completed',
        });
      }
    } else {
      // 2. 明日预计任务: 未完成，且截止/排期在明天
      let isPlannedForTomorrow = false;
      if (task.dueDate === tomorrowDateStr) {
        isPlannedForTomorrow = true;
      }

      if (isPlannedForTomorrow) {
        const meta = extractTaskMetadata(task.title, task.desc);
        let title = task.title;
        if (enableRephrasing) {
          title = rephraseTaskToReportLanguage(task.title, 'daily');
        }

        plannedItems.push({
          id: `task_plan_${task.id}`,
          sourceTaskId: task.id,
          rawTitle: task.title,
          title,
          school: meta.school,
          course: meta.course,
          action: meta.actionText,
          type: 'planned',
        });
      }
    }
  }

  return { completedItems, plannedItems };
}

/**
 * 组装生成规范日报文本内容
 */
export function generateDailyReportContent(
  completedItems: DailyReportItem[],
  plannedItems: DailyReportItem[],
  targetDate: Date = new Date(),
  options: DailyReportOptions = {}
): string {
  const { formatStyle = 'standard', withNumbering = true } = options;
  const dateStr = format(targetDate, 'yyyy年MM月dd日');
  const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekdayStr = weekdayNames[targetDate.getDay()];

  const formatList = (items: DailyReportItem[]) => {
    if (items.length === 0) {
      return '暂无';
    }
    return items
      .map((item, idx) => {
        const prefix = withNumbering ? `${idx + 1}. ` : '- ';
        return `${prefix}${item.title.trim()}`;
      })
      .join('\n');
  };

  if (formatStyle === 'markdown') {
    return `# 工作日报 (${dateStr} ${weekdayStr})

### 一、今日完成工作
${formatList(completedItems)}

### 二、明日预计工作
${formatList(plannedItems)}
`;
  }

  // standard 文本格式 (适合企业微信、钉钉、邮件一键粘贴)
  return `【工作日报】 ${dateStr} ${weekdayStr}

一、今日完成工作:
${formatList(completedItems)}

二、明日预计工作:
${formatList(plannedItems)}`;
}

/**
 * 复制日报内容到系统剪贴板
 */
export async function copyDailyReportToClipboard(content: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(content);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = content;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error('Failed to copy daily report: ', err);
    return false;
  }
}

/**
 * 导出并下载日报文件
 */
export function downloadDailyReportFile(content: string, date: Date, formatStyle: DailyReportFormatStyle) {
  const ext = formatStyle === 'markdown' ? 'md' : 'txt';
  const filename = `工作日报_${format(date, 'yyyy-MM-dd')}.${ext}`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
