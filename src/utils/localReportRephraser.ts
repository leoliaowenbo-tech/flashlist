/**
 * 本地周报语言规范化转述引擎 (Local Weekly Report Rephraser)
 * 纯本地算法，无需接入任何外部 API。
 * 能够自动从零碎口语化的任务便签中：
 * 1. 抽取高校实体 (学校名称) 并将缩写 (贵大/贵理工/海医/民大等) 标准化为全称
 * 2. 抽取课程名称并规范包裹《书名号》
 * 3. 抽取教师/负责人姓名 (于霞老师/赵宇等)
 * 4. 根据所在板块与动作词，规范化转述为体制/高校业务汇报级用语 (如：“建好了” -> “完成...建设与搭建”)
 * 5. 最终组装为规范的：[学校名称]《[课程名称]》[完成了什么具体工作]
 */

// 1. 高校实体字典与别名映射表
export interface SchoolEntity {
  fullName: string;
  aliases: string[];
}

export const KNOWN_SCHOOLS: SchoolEntity[] = [
  { fullName: '贵州大学', aliases: ['贵州大学', '贵大', 'GZU'] },
  { fullName: '贵州理工学院', aliases: ['贵州理工学院', '贵州理工', '贵理工', '贵工'] },
  { fullName: '贵州民族大学', aliases: ['贵州民族大学', '贵州民大', '贵民大', '民大'] },
  { fullName: '贵州师范大学', aliases: ['贵州师范大学', '贵州师大', '贵师大', '贵师'] },
  { fullName: '贵州警察学院', aliases: ['贵州警察学院', '贵州警院', '警院', '警察学院'] },
  { fullName: '滇池学院', aliases: ['云南大学滇池学院', '滇池学院', '滇池'] },
  { fullName: '海南医科大学', aliases: ['海南医科大学', '海南医学院', '海医大', '海医'] },
  { fullName: '贵阳人文科技学院', aliases: ['贵阳人文科技学院', '贵阳人文', '贵人文', '人文科技学院'] },
  { fullName: '茅台学院', aliases: ['茅台学院', '茅台'] },
  { fullName: '遵义师范学院', aliases: ['遵义师范学院', '遵义师范', '遵师'] },
];

// 2. 常见课程名称词典 (用于未加《》时的课程精准提取)
export const KNOWN_COURSES = [
  '热学', '足球英语', '中华礼仪', '化工原理', '信息素养与文献检索', '信息素养',
  '形势与政策实践', '形势与政策', '语文学科教学概论', '物理化学', '分析化学', 
  '现代煤化工技术', '播音主持创作基础', '生态文明教育', '高级英语（一）', '高级英语',
  '基础化学', '葡萄酒工艺学', '环境学概论', '大气污染控制工程', '环境工程原理',
  '王阳明与贵州文化', '融合新闻报道', '艺术作品赏析', '大学语文', '创业理论与实务',
  '有机波谱分析', '数字系统', '机械制图', '环境大亨', '可再生能源', '中华民族共同体概论',
  '系统工程', '电路原理1', '电路原理', '环境监测', '结构力学', '材料力学', '中华文化',
  '无机化学', '固体废物处理与处置', '固态物理', '旅游英语', '大学英语', '线性代数',
  '材料物理', '工程制图', '读论文'
];

// 3. 常见教师/负责人列表
export const KNOWN_TEACHERS = [
  '于霞老师', '陈燕秀老师', '方宏萍老师', '宣文萍老师', '马先果老师', '赵宇', '黄文健'
];

export interface ParsedTaskMetadata {
  school?: string;
  course?: string;
  teacher?: string;
  actionText: string;
  isAlreadyFormatted: boolean;
}

/**
 * 从原始任务标题和描述中深度抽取结构化元数据
 */
export function extractTaskMetadata(rawTitle: string, rawDesc?: string): ParsedTaskMetadata {
  const fullText = `${rawTitle} ${rawDesc || ''}`.trim();
  
  // 1. 抽取书名号中的课程
  let course: string | undefined = undefined;
  const bookMatch = fullText.match(/[《<]([^》>]+)[》>]/);
  if (bookMatch) {
    course = bookMatch[1].trim();
  }

  // 2. 识别学校实体
  let school: string | undefined = undefined;
  for (const s of KNOWN_SCHOOLS) {
    for (const alias of s.aliases) {
      const reg = new RegExp(alias, 'i');
      if (reg.test(fullText)) {
        school = s.fullName;
        break;
      }
    }
    if (school) break;
  }

  // 若未从字典命中，尝试通用正则抽取高校名称 (如 xx大学/xx学院)
  if (!school) {
    const genericSchoolMatch = fullText.match(/([\u4e00-\u9fa5]{2,10}(?:大学|学院|分校|学校))/);
    if (genericSchoolMatch) {
      school = genericSchoolMatch[1];
    }
  }

  // 3. 若书名号未提取到课程，尝试从课程库中匹配
  if (!course) {
    for (const c of KNOWN_COURSES) {
      if (fullText.includes(c)) {
        course = c;
        break;
      }
    }
  }

  // 4. 抽取教师姓名
  let teacher: string | undefined = undefined;
  for (const t of KNOWN_TEACHERS) {
    if (fullText.includes(t)) {
      teacher = t;
      break;
    }
  }
  if (!teacher) {
    const genericTeacherMatch = fullText.match(/([\u4e00-\u9fa5]{2,3}老师)/);
    if (genericTeacherMatch) {
      teacher = genericTeacherMatch[1];
    }
  }

  // 5. 检查是否已经是标准规范格式 (如 贵州大学《热学》完成知识切片建设)
  const isAlreadyFormatted = /^(?:[\u4e00-\u9fa5]+(?:大学|学院))?《[^》]+》(?:完成|推进|开展|检查|优化|新增|制作|上线|汇报|搭建)/.test(rawTitle.trim())
    || /^完成[\u4e00-\u9fa5]+[0-9]+门课程/.test(rawTitle.trim())
    || /^组织召开/.test(rawTitle.trim())
    || /^梳理并填报/.test(rawTitle.trim());

  // 清洗剩余动作文本
  let actionText = rawTitle;
  // 移除标签
  actionText = actionText.replace(/#\S+/g, '');
  // 如果已提取到学校且原标题开头就是学校名，暂存
  if (school) {
    for (const alias of KNOWN_SCHOOLS.find(s => s.fullName === school)?.aliases || [school]) {
      actionText = actionText.replace(new RegExp(alias, 'g'), '');
    }
  }
  if (course) {
    actionText = actionText.replace(new RegExp(`《?${escapeRegExp(course)}》?`, 'g'), '');
  }
  if (teacher) {
    actionText = actionText.replace(new RegExp(teacher, 'g'), '');
  }
  actionText = actionText.replace(/[《》【】]/g, '').trim();

  return {
    school,
    course,
    teacher,
    actionText,
    isAlreadyFormatted,
  };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 根据板块和提取到的动作文本，转述为体制与高校业务的专业成果描述
 */
export function normalizeActionDescription(
  sectionId: string, 
  rawAction: string, 
  metadata: ParsedTaskMetadata
): string {
  const text = rawAction.toLowerCase();

  // 若原文本本身已经写得很清晰且具有完整动宾短语，优先保留并适度润色
  if (rawAction.length >= 8 && (rawAction.startsWith('完成') || rawAction.startsWith('推进') || rawAction.startsWith('组织'))) {
    return rawAction;
  }

  switch (sectionId) {
    case 'new_courses':
      // 二、新建AI课程格式：仅保留学校与《课程名》
      return '';

    case 'knowledge_graph':
      // 知识图谱板块
      if (text.includes('思政')) return '完成思政图谱搭建';
      if (text.includes('能力')) return '完成能力图谱建设与汇报';
      if (text.includes('素质')) return '推进素质图谱及知识点检查与修改';
      if (text.includes('检查') || text.includes('进度') || text.includes('排查')) return '检查知识图谱建设进度';
      if (text.includes('修改') || text.includes('改好') || text.includes('更新')) return '完成知识图谱修改';
      if (text.includes('集中') || text.includes('验收') || text.includes('挂载')) return '完成知识图谱集中检查及资源挂载';
      if (text.includes('分配') || text.includes('跟进')) return '推进图谱建设任务分配与进度跟进';
      return '完成知识图谱搭建与完善';

    case 'knowledge_slices':
      // 知识碎片库板块
      if (text.includes('归档') || text.includes('大整理') || text.includes('整理')) return '完成全量课程知识切片归档与规范化大整理';
      return '完成知识切片建设';

    case 'ai_toolbox':
      // AI工具箱板块
      if (text.includes('html') || text.includes('网页') || text.includes('上线') || text.includes('互动')) return '完成HTML互动应用网页上线';
      if (text.includes('百宝箱') || text.includes('工具箱')) {
        if (text.includes('新增') || text.includes('制作')) return '新增制作1个特色教学百宝箱';
        if (text.includes('优化') || text.includes('修改')) return '推进教学百宝箱优化修改';
        return '推进教学百宝箱建设';
      }
      if (text.includes('引导') || text.includes('问题')) return '推进问题引导建设';
      if (text.includes('提示词') || text.includes('prompt')) return '提示词工程整体梳理及各提示词任务标准化优化';
      if (text.includes('测试') || text.includes('验证') || text.includes('工具')) return '测试工具验证及相关资料推进';
      if (text.includes('审查') || text.includes('集中')) return '完成AI工具箱及教学百宝箱集中审查';
      return '推进教学百宝箱建设与工具优化';

    case 'digital_human':
      // 数字人板块
      if (text.includes('讲稿') || text.includes('section') || text.includes('引用')) return '数字人引用及讲稿分Section处理';
      if (text.includes('催收') || text.includes('预约') || text.includes('录制')) return '集中催收未按时提交的数字人讲稿及资料，推进预约录制';
      if (text.includes('卡通') || text.includes('形象设计') || text.includes('形象制作')) return '卡通数字人形象设计与制作';
      if (text.includes('时长') || text.includes('排查')) return '完成数字人时长集中排查';
      if (text.includes('训练') || text.includes('视频') || text.includes('挂载')) return '完成数字人形象训练及挂载形象，部分课程已完成数字人视频生成';
      if (text.includes('调节') || text.includes('优化')) return '数字人调节与优化';
      if (text.includes('问题') || text.includes('汇报')) return '汇报与排查数字人问题';
      return '数字人制作与优化推进';

    case 'agent':
      // 智能体建设板块
      if (text.includes('模型') || text.includes('底层') || text.includes('适配')) return '推进智能体底层模型切换与适配';
      if (text.includes('读论文') || (metadata.teacher && metadata.teacher.includes('于霞'))) return '于霞老师“读论文”特色智能体开发推进';
      if (text.includes('特色') || text.includes('新增') || text.includes('对接') || text.includes('开发')) return '对接并新增开发1个特色智能体';
      if (text.includes('优化') || text.includes('修改') || text.includes('功能')) return '智能体功能优化与修改';
      return '特色智能体需求对接与开发推进';

    case 'portal':
      // 门户设计
      return '智慧课程整体门户建设与规范化搭建';

    case 'course_application':
      // 课程应用板块
      if (text.includes('工作坊') || text.includes('功能汇报')) return '新开发功能汇报及应用培训工作坊';
      if (text.includes('预警') || text.includes('使用情况')) return '课程功能培训及教师使用情况预警生成';
      if (text.includes('解答') || text.includes('问题')) return '教师培训问题解答与培训工作坊召开';
      if (text.includes('深度') || text.includes('推进')) return '整体应用深度推进';
      if (text.includes('需求') || text.includes('跟踪')) return '课程应用推进及需求跟踪';
      if (text.includes('培训')) return '教师应用功能培训与推进';
      return '课程功能培训、进度汇报与应用推进';

    case 'acceptance':
      // 交付验收
      if (text.includes('终期')) return '完成终期验收，智慧专业验收延期到十月底';
      if (text.includes('中期')) return '完成中期验收';
      return '完成验收';

    case 'aftersales':
      // 售后服务
      if (text.includes('名单') || text.includes('导入') || text.includes('学生')) return '各高校教师及学生名单批量导入与异常排查';
      if (text.includes('班级') || text.includes('异常')) return '处理班级管理异常问题';
      if (text.includes('习题') || text.includes('批改') || text.includes('识图')) return '习题库录入、批改规则制定与核查';
      if (text.includes('挂载') || text.includes('教材') || text.includes('外链')) return '课程资源挂载与教材上传';
      if (text.includes('论文') || text.includes('模块')) return '论文模块设计与质量检查';
      if (text.includes('启动会')) return '组织召开课程启动会';
      if (text.includes('专业') || text.includes('学科')) return '推进智慧专业建设、方案检查修改及任务分派';
      return rawAction || '完成日常教学需求沟通与资料对接维护';

    case 'next_week':
      // 下周核心工作
      if (text.includes('验收')) return '课程验收准备';
      if (text.includes('启动')) return '多门课程集中启动准备';
      if (text.includes('对接') || text.includes('交接') || text.includes('离职')) return '课程对接推进建设进度';
      return rawAction ? `${rawAction}准备与推进` : '核心工作推进与进度跟进';

    default:
      return rawAction || '完成相关工作任务';
  }
}

/**
 * 核心转述函数：将一条任务组装为高水准的标准周报语句
 */
export function rephraseTaskToReportLanguage(
  rawTitle: string, 
  sectionId: string, 
  rawDesc?: string
): string {
  if (!rawTitle || !rawTitle.trim()) return '';

  const meta = extractTaskMetadata(rawTitle, rawDesc);

  // 如果原任务标题已经是完整规范的句子（如用户示例中的原句），并且元素齐全，直接返回
  if (meta.isAlreadyFormatted && meta.actionText.length > 5) {
    return rawTitle.trim();
  }

  // 1. 新建课程板块，纯输出：[学校名称]《[课程名称]》
  if (sectionId === 'new_courses') {
    if (meta.school && meta.course) {
      return `${meta.school}《${meta.course}》`;
    }
    if (meta.course) {
      return `《${meta.course}》`;
    }
    return rawTitle.trim();
  }

  // 2. 规范化动作短语
  const actionPhrase = normalizeActionDescription(sectionId, meta.actionText, meta);

  // 3. 特殊集中/批量排查处理 (如: 完成贵州大学30门课程知识图谱终期验收前集中检查及资源挂载)
  const countMatch = rawTitle.match(/([0-9]+)门课/);
  if (countMatch && meta.school) {
    const count = countMatch[1];
    if (sectionId === 'knowledge_graph') {
      return `完成${meta.school}${count}门课程知识图谱中期验收前集中检查及资源挂载`;
    }
    if (sectionId === 'ai_toolbox') {
      return `完成${meta.school}${count}门课程AI工具箱及教学百宝箱集中审查`;
    }
    if (sectionId === 'digital_human') {
      return `完成${meta.school}${count}门课程数字人时长集中排查`;
    }
  }

  // 4. 标准语法组装模式：[学校名称]《[课程名称]》[具体工作]
  const parts: string[] = [];
  if (meta.school) {
    parts.push(meta.school);
  }
  if (meta.teacher && !actionPhrase.includes(meta.teacher)) {
    parts.push(meta.teacher);
  }
  if (meta.course) {
    parts.push(`《${meta.course}》`);
  }

  const prefix = parts.join('');
  if (prefix) {
    // 检查动作短语开头是否带有动词，如果有或者没有，整洁拼合
    return `${prefix}${actionPhrase}`;
  }

  // 如果没有识别到学校与课程，则使用动作短语或原标题
  return actionPhrase || rawTitle.trim();
}
