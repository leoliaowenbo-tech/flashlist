import { format, addDays, Day } from 'date-fns';

export interface ParseResult {
  hasDate: boolean;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  matchedText?: string;
  cleanTitle: string;
}

const WEEKDAY_MAP: Record<string, Day> = {
  '日': 0, '天': 0, '七': 0,
  '一': 1,
  '二': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
};

export function parseNaturalDate(input: string): ParseResult {
  if (!input || !input.trim()) {
    return { hasDate: false, cleanTitle: input };
  }

  const now = new Date();
  let matchedDate: Date | null = null;
  let matchedTimeStr: string | undefined = undefined;
  let matchedSubstrings: string[] = [];

  let text = input;

  // 1. 相对日期
  const relativeMatch = text.match(/(今天|今日|明天|明日|后天|大后天|(\d+)天后)/);
  if (relativeMatch) {
    const raw = relativeMatch[0];
    matchedSubstrings.push(raw);
    if (raw === '今天' || raw === '今日') {
      matchedDate = now;
    } else if (raw === '明天' || raw === '明日') {
      matchedDate = addDays(now, 1);
    } else if (raw === '后天') {
      matchedDate = addDays(now, 2);
    } else if (raw === '大后天') {
      matchedDate = addDays(now, 3);
    } else if (relativeMatch[2]) {
      const days = parseInt(relativeMatch[2], 10);
      matchedDate = addDays(now, days);
    }
  }

  // 2. 星期
  if (!matchedDate) {
    const weekMatch = text.match(/(本周|这周|下周|下星期|星期|周|礼拜)([一二三四五六日天])/);
    if (weekMatch) {
      const prefix = weekMatch[1];
      const dayChar = weekMatch[2];
      const targetDay = WEEKDAY_MAP[dayChar];

      if (targetDay !== undefined) {
        matchedSubstrings.push(weekMatch[0]);
        const currentDay = now.getDay() as Day;
        let dayDiff = (targetDay - currentDay + 7) % 7;
        
        if (prefix.includes('下')) {
          dayDiff += 7;
        } else if (dayDiff === 0) {
          dayDiff = 7;
        }
        matchedDate = addDays(now, dayDiff);
      }
    }
  }

  // 3. 绝对日期
  if (!matchedDate) {
    const absDateMatch = text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?/);
    if (absDateMatch) {
      matchedSubstrings.push(absDateMatch[0]);
      const year = absDateMatch[1] ? parseInt(absDateMatch[1], 10) : now.getFullYear();
      const month = parseInt(absDateMatch[2], 10) - 1;
      const day = parseInt(absDateMatch[3], 10);
      matchedDate = new Date(year, month, day);
    }
  }

  // 4. 具体时刻
  const timePeriodMatch = text.match(/(早上|早晨|上午|中午|下午|晚上|夜里|今晚|明晚)?\s*(\d{1,2})(?:[:：](\d{1,2})|点(?:半|(\d{1,2})分?)?)?/);
  if (timePeriodMatch && timePeriodMatch[0].trim()) {
    const fullMatch = timePeriodMatch[0].trim();
    const hasPeriod = !!timePeriodMatch[1];
    const hasColon = fullMatch.includes(':') || fullMatch.includes('：');
    const hasDian = fullMatch.includes('点');

    if (hasPeriod || hasColon || hasDian) {
      matchedSubstrings.push(fullMatch);
      const period = timePeriodMatch[1] || '';
      let hour = parseInt(timePeriodMatch[2], 10);
      let minute = 0;

      if (fullMatch.includes('半')) {
        minute = 30;
      } else if (timePeriodMatch[3]) {
        minute = parseInt(timePeriodMatch[3], 10);
      } else if (timePeriodMatch[4]) {
        minute = parseInt(timePeriodMatch[4], 10);
      }

      if ((period === '下午' || period === '晚上' || period === '夜里' || period === '今晚' || period === '明晚') && hour < 12) {
        hour += 12;
      } else if ((period === '中午') && hour === 12) {
        hour = 12;
      }

      const hStr = hour.toString().padStart(2, '0');
      const mStr = minute.toString().padStart(2, '0');
      matchedTimeStr = `${hStr}:${mStr}`;

      if (!matchedDate) {
        if (period === '明晚') {
          matchedDate = addDays(now, 1);
        } else {
          matchedDate = now;
        }
      }
    }
  }

  if (!matchedDate) {
    return {
      hasDate: false,
      cleanTitle: input.trim(),
    };
  }

  let cleanTitle = text;
  matchedSubstrings.forEach((sub) => {
    cleanTitle = cleanTitle.replace(sub, ' ');
  });
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
  if (!cleanTitle) {
    cleanTitle = input.trim();
  }

  const dueDateStr = format(matchedDate, 'yyyy-MM-dd');

  return {
    hasDate: true,
    dueDate: dueDateStr,
    dueTime: matchedTimeStr,
    matchedText: matchedSubstrings.join(' '),
    cleanTitle,
  };
}
