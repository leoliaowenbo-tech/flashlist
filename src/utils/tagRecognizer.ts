export interface TagRule {
  tag: string;
  keywords: string[];
  enabled: boolean;
}

export interface MatchedTag {
  tag: string;
  matchedKeyword: string;
}

export const DEFAULT_TAG_RULES: TagRule[] = [
  {
    tag: '三大图谱建设',
    keywords: ['图谱', '知识图谱', '问题图谱', '能力图谱', '素质图谱', '思政点', '知识库', '知识点关联', '外链挂载', '教材上传'],
    enabled: true,
  },
  {
    tag: '智能体建设',
    keywords: ['智能体', '学伴', '助手', '3D建模', '大亨', 'Agent'],
    enabled: true,
  },
  {
    tag: '指令库（ai工具箱）',
    keywords: ['指令', '指令库', '百宝箱', '百宝', '批改', 'Prompt', '提示词'],
    enabled: true,
  },
  {
    tag: '数字人任务',
    keywords: ['数字人', '虚拟人', '形象生成', '卡通形象', '数字人视频'],
    enabled: true,
  },
  {
    tag: '知识碎片库',
    keywords: ['切片', '习题', '习题库', '出题', '录入', '视频转码'],
    enabled: true,
  },
  {
    tag: '售前',
    keywords: ['售前', '启动会', '方案', '对接', '建设方案', '试用'],
    enabled: true,
  },
  {
    tag: '课程需求汇总',
    keywords: ['需求', '【需求】', '功能需求', '新问题', '进度汇报'],
    enabled: true,
  },
  {
    tag: '课程应用（如培训等）',
    keywords: ['培训', '工作坊', '教研室', '讲座', '录屏', '案例分享'],
    enabled: true,
  },
  {
    tag: '售后服务和其他工作',
    keywords: ['售后', '名单', '班级信息', '权限', '账号', '申报', '例会', '会议'],
    enabled: true,
  },
  {
    tag: '验收交付',
    keywords: ['验收', '交付', '结项', '亮点撰写', '成果汇编'],
    enabled: true,
  },
  {
    tag: '新建AI课程',
    keywords: ['新建课程', '新建AI课程', '建课', '新开课程'],
    enabled: true,
  },
  {
    tag: 'AI课门户设计',
    keywords: ['门户', '门户设计', '门户建设', '规范化搭建', '智慧课程整体门户'],
    enabled: true,
  },
  {
    tag: '课程成果',
    keywords: ['成果', '获奖', '比赛', '教学成果', '成果汇编'],
    enabled: true,
  },
  {
    tag: '下周核心工作',
    keywords: ['下周', '下周计划', '下周工作', '后续计划'],
    enabled: true,
  },
];

const STORAGE_KEY_TAG_RULES = 'flashlist_auto_tag_rules';

export function getTagRules(): TagRule[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TAG_RULES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // fallback to default
  }
  return DEFAULT_TAG_RULES;
}

export function saveTagRules(rules: TagRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TAG_RULES, JSON.stringify(rules));
  } catch (e) {
    console.error('Failed to save tag rules to localStorage', e);
  }
}

export function addTagRule(tag: string, keywords: string[] = []): TagRule[] {
  const rules = getTagRules();
  const existingIdx = rules.findIndex(r => r.tag === tag);
  let updatedRules: TagRule[];

  if (existingIdx >= 0) {
    const existing = rules[existingIdx];
    const mergedKeywords = Array.from(new Set([...existing.keywords, ...keywords]));
    updatedRules = [...rules];
    updatedRules[existingIdx] = { ...existing, keywords: mergedKeywords, enabled: true };
  } else {
    const newRule: TagRule = {
      tag,
      keywords,
      enabled: true,
    };
    updatedRules = [...rules, newRule];
  }

  saveTagRules(updatedRules);
  return updatedRules;
}

export function deleteTagRule(tag: string): TagRule[] {
  const rules = getTagRules();
  const updatedRules = rules.filter(r => r.tag !== tag);
  saveTagRules(updatedRules);
  return updatedRules;
}

export function renameTagRule(oldTag: string, newTag: string): TagRule[] {
  const rules = getTagRules();
  const updatedRules = rules.map(r => (r.tag === oldTag ? { ...r, tag: newTag } : r));
  saveTagRules(updatedRules);
  return updatedRules;
}

/**
 * 根据输入文本匹配自动打标规则
 * 支持大小写不敏感匹配，支持一个文本匹配多个不同标签
 */
export function matchTagsFromText(text: string, rules?: TagRule[]): MatchedTag[] {
  if (!text || !text.trim()) return [];
  const activeRules = rules || getTagRules();
  const lowerText = text.toLowerCase();
  const results: MatchedTag[] = [];
  const seenTags = new Set<string>();

  for (const rule of activeRules) {
    if (!rule.enabled) continue;
    for (const kw of rule.keywords) {
      const lowerKw = kw.toLowerCase().trim();
      if (!lowerKw) continue;
      if (lowerText.includes(lowerKw)) {
        if (!seenTags.has(rule.tag)) {
          seenTags.add(rule.tag);
          results.push({ tag: rule.tag, matchedKeyword: kw });
        }
        break; // 该标签已命中，跳过检查该规则下的其他词
      }
    }
  }

  return results;
}
