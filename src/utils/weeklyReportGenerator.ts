import { Task } from '../types';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  subWeeks, 
  addWeeks, 
  isWithinInterval, 
  parseISO, 
  isValid, 
  getISOWeek, 
  getYear,
  startOfDay,
  endOfDay
} from 'date-fns';
import { rephraseTaskToReportLanguage, extractTaskMetadata } from './localReportRephraser';

export interface ReportItem {
  id: string;
  title: string;
  rawTitle?: string;
  school?: string;
  course?: string;
  action?: string;
  sourceTaskId?: string;
  sectionId: string;
  subSectionId?: string;
  isCustom?: boolean;
}

export interface ReportSubsectionDef {
  id: string;
  title: string;
  keywords: string[];
}

export interface ReportSectionDef {
  id: string;
  code: string;
  title: string;
  categoryName: string;
  defaultPlaceholder?: string;
  keywords: string[];
  tags: string[];
  hasSubsections?: boolean;
  subsections?: ReportSubsectionDef[];
}

export const REPORT_SECTIONS: ReportSectionDef[] = [
  {
    id: 'presales',
    code: '一',
    title: '一、售前沟通:',
    categoryName: '售前沟通',
    defaultPlaceholder: '-售前表格截图:',
    keywords: ['售前', '售前沟通', '售前表格', '商务', '标书', '投标', '需求调研', '建设方案沟通'],
    tags: ['售前'],
  },
  {
    id: 'new_courses',
    code: '二',
    title: '二、新建AI课程:',
    categoryName: '新建AI课程',
    keywords: ['新建', '建课', '新开', '新增课程', '新建课程', '新建ai课程', '新课搭建'],
    tags: ['新建AI课程', '建课', '新建课程'],
  },
  {
    id: 'knowledge_graph',
    code: '三-1',
    title: '三、第1部分 知识图谱建设:',
    categoryName: '知识图谱建设',
    keywords: ['图谱', '知识图谱', '能力图谱', '素质图谱', '思政图谱', '问题图谱', '三大图谱', '思政点'],
    tags: ['三大图谱建设', '知识图谱', '图谱'],
  },
  {
    id: 'knowledge_slices',
    code: '三-2',
    title: '三、第2部分 知识碎片库建设:',
    categoryName: '知识碎片库建设',
    keywords: ['切片', '碎片', '知识切片', '知识碎片', '碎片库', '切片建设'],
    tags: ['知识碎片库', '知识切片'],
  },
  {
    id: 'ai_toolbox',
    code: '三-3',
    title: '三、第3部分 AI工具箱建设:',
    categoryName: 'AI工具箱建设',
    keywords: ['工具箱', '百宝箱', '教学百宝箱', '互动应用', 'html互动', '提示词', '指令', '指令库', 'prompt', '问题引导', '测试工具', '豆秀绿'],
    tags: ['指令库（ai工具箱）', 'AI工具箱', '百宝箱'],
  },
  {
    id: 'digital_human',
    code: '四',
    title: '四、第4部分 数字人建设:',
    categoryName: '数字人建设',
    keywords: ['数字人', '虚拟人', '讲稿', '数字人视频', '形象设计', '形象训练', '卡通形象', '预约录制', '数字人时长', '形象制作'],
    tags: ['数字人任务', '数字人'],
  },
  {
    id: 'agent',
    code: '五',
    title: '五、第5部分 智能体建设:',
    categoryName: '智能体建设',
    keywords: ['智能体', 'agent', '特色智能体', '学伴', '读论文', '模型切换', '大亨'],
    tags: ['智能体建设', '智能体'],
  },
  {
    id: 'portal',
    code: '六',
    title: '六、AI课门户设计:',
    categoryName: 'AI课门户设计',
    keywords: ['门户', '门户设计', '整体门户', '规范化搭建', '门户搭建', '智慧课程整体门户', '课程主页', '门户建设'],
    tags: ['AI课门户', '门户设计', '门户'],
  },
  {
    id: 'course_application',
    code: '七',
    title: '七、课程应用相关:',
    categoryName: '课程应用相关',
    keywords: ['培训', '工作坊', '应用推进', '功能汇报', '课程应用', '使用情况', '预警', '教师培训', '答疑', '深度推进', '需求跟踪'],
    tags: ['课程应用（如培训等）', '课程应用'],
  },
  {
    id: 'acceptance',
    code: '八',
    title: '八、交付验收:',
    categoryName: '交付验收',
    keywords: ['验收', '交付', '终期验收', '中期验收', '结项', '阶段验收', '终审'],
    tags: ['验收交付', '交付验收', '验收'],
  },
  {
    id: 'course_achievements',
    code: '九',
    title: '九、课程成果:',
    categoryName: '课程成果',
    defaultPlaceholder: '-',
    keywords: ['成果', '获奖', '比赛', '竞赛', '论文发表', '成果汇编', '亮点撰写', '课程成果'],
    tags: ['课程成果', '成果'],
  },
  {
    id: 'aftersales',
    code: '十',
    title: '十、售后服务及其他工作:',
    categoryName: '售后服务及其他工作',
    hasSubsections: true,
    subsections: [
      {
        id: 'specialty',
        title: '专业与学科建设：',
        keywords: ['专业', '学科', '学科引擎', '毕业要求', '建设方案', '工作计划表', '方案检查', '专业建设'],
      },
      {
        id: 'kickoff',
        title: '启动会与统筹对接：',
        keywords: ['启动会', '启动准备', '筹备与召开', '统筹对接', '集中启动', '建课启动'],
      },
      {
        id: 'daily_ops',
        title: '日常运营、资源挂载与数据维护：',
        keywords: ['名单', '导入', '班级', '习题', '批改', '挂载', '教材', '排查', '维护', '共享表', '运营', '量化表', '数据集', '模型方案', '需求沟通', '资料对接', '外链', '论文模块'],
      },
    ],
    keywords: ['售后', '日常运营', '运维', '支持', '答疑', '名单', '资源挂载', '数据维护'],
    tags: ['售后服务和其他工作', '售后'],
  },
  {
    id: 'next_week',
    code: '十一',
    title: '十一、下周核心工作:',
    categoryName: '下周核心工作',
    keywords: ['下周', '下周计划', '下周核心工作', '下周推进', '后续计划', '下周准备'],
    tags: ['下周'],
  },
];

/**
 * 模板示例数据 (根据用户提供的真实业务模板内置)
 */
export const TEMPLATE_EXAMPLE_ITEMS: ReportItem[] = [
  // 售前沟通
  { id: 'ex_pre_1', title: '-售前表格截图:', sectionId: 'presales' },

  // 新建AI课程
  { id: 'ex_new_1', title: '贵州大学《热学》', sectionId: 'new_courses' },
  { id: 'ex_new_2', title: '贵州警察学院《足球英语》', sectionId: 'new_courses' },
  { id: 'ex_new_3', title: '贵州民族大学《中华礼仪》', sectionId: 'new_courses' },
  { id: 'ex_new_4', title: '贵州理工学院《化工原理》', sectionId: 'new_courses' },
  { id: 'ex_new_5', title: '贵州理工学院《信息素养与文献检索》', sectionId: 'new_courses' },
  { id: 'ex_new_6', title: '贵州大学《形势与政策实践》', sectionId: 'new_courses' },
  { id: 'ex_new_7', title: '贵州师范大学《语文学科教学概论》', sectionId: 'new_courses' },
  { id: 'ex_new_8', title: '贵州民族大学《物理化学》', sectionId: 'new_courses' },
  { id: 'ex_new_9', title: '贵州民族大学《分析化学》', sectionId: 'new_courses' },
  { id: 'ex_new_10', title: '贵州民族大学《现代煤化工技术》', sectionId: 'new_courses' },
  { id: 'ex_new_11', title: '贵州民族大学《播音主持创作基础》', sectionId: 'new_courses' },

  // 知识图谱建设
  { id: 'ex_kg_1', title: '贵州理工学院《生态文明教育》检查知识图谱建设进度', sectionId: 'knowledge_graph' },
  { id: 'ex_kg_2', title: '滇池学院《高级英语（一）》完成知识图谱修改', sectionId: 'knowledge_graph' },
  { id: 'ex_kg_3', title: '海南医科大学《基础化学》完成能力图谱建设与汇报', sectionId: 'knowledge_graph' },
  { id: 'ex_kg_4', title: '推进《葡萄酒工艺学》素质图谱及知识点检查与修改', sectionId: 'knowledge_graph' },
  { id: 'ex_kg_5', title: '贵州理工学院《环境学概论》完成思政图谱搭建', sectionId: 'knowledge_graph' },
  { id: 'ex_kg_6', title: '推进赵宇、黄文健图谱建设任务分配与进度跟进', sectionId: 'knowledge_graph' },
  { id: 'ex_kg_7', title: '完成贵州大学30门课程知识图谱终期验收前集中检查及资源挂载', sectionId: 'knowledge_graph' },
  { id: 'ex_kg_8', title: '完成贵州理工学院28门课程知识图谱中期验收前集中检查及资源挂载', sectionId: 'knowledge_graph' },
  { id: 'ex_kg_9', title: '完成贵阳人文科技学院5门课程知识图谱中期验收前集中检查及资源挂载', sectionId: 'knowledge_graph' },

  // 知识碎片库建设
  { id: 'ex_ks_1', title: '贵州大学《热学》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_2', title: '《形势与政策实践》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_3', title: '滇池学院《高级英语（一）》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_4', title: '《大气污染控制工程》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_5', title: '《环境工程原理》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_6', title: '《王阳明与贵州文化》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_7', title: '滇池学院《融合新闻报道》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_8', title: '滇池学院《艺术作品赏析》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_9', title: '贵阳人文科技学院《大学语文》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_10', title: '贵阳人文科技学院《创业理论与实务》完成知识切片建设', sectionId: 'knowledge_slices' },
  { id: 'ex_ks_11', title: '完成全量课程知识切片归档与规范化大整理', sectionId: 'knowledge_slices' },

  // AI工具箱建设
  { id: 'ex_ai_1', title: '海南医科大学《分析化学》推进教学百宝箱建设', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_2', title: '海南医科大学《基础化学》完成HTML互动应用网页上线', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_3', title: '推进《有机波谱分析》问题引导建设', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_4', title: '推进《数字系统》教学百宝箱优化修改', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_5', title: '贵州理工学院《机械制图》豆秀绿测试工具验证及相关资料推进', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_6', title: '贵州理工学院《环境大亨》互动应用修改、优化及最终版制作', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_7', title: '茅台学院《葡萄酒工艺学》新增制作1个特色教学百宝箱', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_8', title: '贵阳人文科技学院《大学语文》教学百宝箱建设', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_9', title: '提示词工程整体梳理及各提示词任务标准化优化', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_10', title: '完成贵州大学30门课程AI工具箱及教学百宝箱集中审查', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_11', title: '完成贵州理工学院28门课程AI工具箱及教学百宝箱集中审查', sectionId: 'ai_toolbox' },
  { id: 'ex_ai_12', title: '完成贵阳人文科技学院5门课程AI工具箱及教学百宝箱集中审查', sectionId: 'ai_toolbox' },

  // 数字人建设
  { id: 'ex_dh_1', title: '滇池学院3门课程汇报数字人问题', sectionId: 'digital_human' },
  { id: 'ex_dh_2', title: '滇池学院《高级英语（一）》数字人引用及讲稿分Section六处理', sectionId: 'digital_human' },
  { id: 'ex_dh_3', title: '集中催收未按时提交的数字人讲稿及资料，推进预约录制', sectionId: 'digital_human' },
  { id: 'ex_dh_4', title: '贵州大学《可再生能源》数字人任务检查', sectionId: 'digital_human' },
  { id: 'ex_dh_5', title: '贵州大学《中华民族共同体概论》卡通数字人形象设计与制作', sectionId: 'digital_human' },
  { id: 'ex_dh_6', title: '贵州大学《数字系统》数字人调节与优化', sectionId: 'digital_human' },
  { id: 'ex_dh_7', title: '贵州理工学院《环境学概论》数字人制作与优化', sectionId: 'digital_human' },
  { id: 'ex_dh_8', title: '贵州大学《系统工程》数字人制作与新资源引入', sectionId: 'digital_human' },
  { id: 'ex_dh_9', title: '完成贵州大学30门课程数字人时长集中排查', sectionId: 'digital_human' },
  { id: 'ex_dh_10', title: '完成贵州理工学院28门课程数字人形象训练及挂载形象，部分课程已完成数字人视频生成', sectionId: 'digital_human' },

  // 智能体建设
  { id: 'ex_ag_1', title: '推进智能体底层模型切换与适配', sectionId: 'agent' },
  { id: 'ex_ag_2', title: '贵州理工学院《电路原理1》对接并新增开发1个特色智能体', sectionId: 'agent' },
  { id: 'ex_ag_3', title: '贵州理工学院《环境监测》新增开发1个特色智能体', sectionId: 'agent' },
  { id: 'ex_ag_4', title: '贵州理工学院于霞老师“读论文”特色智能体开发推进', sectionId: 'agent' },
  { id: 'ex_ag_5', title: '贵州大学《系统工程》新增开发1个特色智能体', sectionId: 'agent' },
  { id: 'ex_ag_6', title: '遵义师范学院《结构力学》智能体功能优化与修改', sectionId: 'agent' },
  { id: 'ex_ag_7', title: '陈燕秀老师课程特色智能体需求对接与开发推进', sectionId: 'agent' },

  // AI课门户设计
  { id: 'ex_pt_1', title: '贵州大学多门智慧课程整体门户建设与规范化搭建', sectionId: 'portal' },
  { id: 'ex_pt_2', title: '贵州理工学院多门智慧课程整体门户建设与规范化搭建', sectionId: 'portal' },
  { id: 'ex_pt_3', title: '贵阳人文科技学院多门智慧课程整体门户建设与规范化搭建', sectionId: 'portal' },

  // 课程应用相关
  { id: 'ex_app_1', title: '海南医科大学《分析化学》、《基础化学》新开发功能汇报及应用培训工作坊', sectionId: 'course_application' },
  { id: 'ex_app_2', title: '滇池学院《高级英语（一）》功能培训、进度汇报与应用推进', sectionId: 'course_application' },
  { id: 'ex_app_3', title: '贵州民族大学《旅游英语》功能培训与推进', sectionId: 'course_application' },
  { id: 'ex_app_4', title: '贵州大学《中华民族共同体概论》课程功能培训及教师使用情况预警生成', sectionId: 'course_application' },
  { id: 'ex_app_5', title: '贵州师范大学数学科学学院教师培训问题解答与培训工作坊召开', sectionId: 'course_application' },
  { id: 'ex_app_6', title: '贵州理工学院《环境学概论》教师应用培训', sectionId: 'course_application' },
  { id: 'ex_app_7', title: '海南医科大学《大学英语》整体应用深度推进', sectionId: 'course_application' },
  { id: 'ex_app_8', title: '马先果老师课程应用推进及需求跟踪', sectionId: 'course_application' },

  // 交付验收
  { id: 'ex_ac_1', title: '贵州大学30门课程完成终期验收，智慧专业验收延期到十月底', sectionId: 'acceptance' },
  { id: 'ex_ac_2', title: '贵州理工学院28门课程完成中期验收', sectionId: 'acceptance' },
  { id: 'ex_ac_3', title: '海南医科大学《基础化学》+《分析化学》完成验收', sectionId: 'acceptance' },

  // 课程成果
  { id: 'ex_ach_1', title: '-', sectionId: 'course_achievements' },

  // 售后服务及其他工作 - 专业与学科建设
  { id: 'ex_as_s1', title: '贵州大学“7大学科引擎+4大专业建设”及化工智慧专业进度汇报', sectionId: 'aftersales', subSectionId: 'specialty' },
  { id: 'ex_as_s2', title: '推进贵州大学、贵州理工学院智慧专业建设、方案检查修改及系主任/课程教师任务分派', sectionId: 'aftersales', subSectionId: 'specialty' },
  { id: 'ex_as_s3', title: '贵州大学机械工程专业毕业要求录入修正与建设方案修改', sectionId: 'aftersales', subSectionId: 'specialty' },
  { id: 'ex_as_s4', title: '梳理并填报贵州理工学院3个智慧专业建设进度及工作计划表', sectionId: 'aftersales', subSectionId: 'specialty' },

  // 售后服务及其他工作 - 启动会与统筹对接
  { id: 'ex_as_k1', title: '组织召开贵州民族大学化学工程学院《材料力学》启动会', sectionId: 'aftersales', subSectionId: 'kickoff' },
  { id: 'ex_as_k2', title: '组织召开贵州民族大学《中华文化》课程启动会', sectionId: 'aftersales', subSectionId: 'kickoff' },
  { id: 'ex_as_k3', title: '推进贵州民族大学3门课程集中启动会筹备与召开', sectionId: 'aftersales', subSectionId: 'kickoff' },
  { id: 'ex_as_k4', title: '贵州师范大学《语文学科教学概论》建课启动准备', sectionId: 'aftersales', subSectionId: 'kickoff' },

  // 售后服务及其他工作 - 日常运营、资源挂载与数据维护
  { id: 'ex_as_d1', title: '各高校教师及学生名单批量导入与异常排查（贵州师范大学、茅台学院《大学英语》、海南医科大学《基础化学》等）', sectionId: 'aftersales', subSectionId: 'daily_ops' },
  { id: 'ex_as_d2', title: '处理班级管理异常问题（贵阳人文科技学院创业学院、线性代数等）', sectionId: 'aftersales', subSectionId: 'daily_ops' },
  { id: 'ex_as_d3', title: '习题库录入、批改规则制定与核查（《机械制图》、《固体废物处理与处置》识图批改规则、《环境监测》、《固态物理》、《生态文明教育》、《旅游英语》、《信息素养》等）', sectionId: 'aftersales', subSectionId: 'daily_ops' },
  { id: 'ex_as_d4', title: '课程资源挂载与教材上传（《中华礼仪》外链挂载、滇池学院3门课资源及作业挂载、贵理工《环境学概论》、贵师大《语文学科教学概论》、贵人文《大学语文》等）', sectionId: 'aftersales', subSectionId: 'daily_ops' },
  { id: 'ex_as_d5', title: '海南医科大学《基础化学》论文模块设计与质量检查', sectionId: 'aftersales', subSectionId: 'daily_ops' },
  { id: 'ex_as_d6', title: '方宏萍老师、宣文萍老师（《无机化学》）、陈燕秀老师等日常教学需求沟通与资料对接', sectionId: 'aftersales', subSectionId: 'daily_ops' },
  { id: 'ex_as_d7', title: '完成考核量化表设计、数据集制作、大模型方案调整、视频制作及建设进度共享表维护更新', sectionId: 'aftersales', subSectionId: 'daily_ops' },

  // 下周核心工作
  { id: 'ex_nw_1', title: '贵阳人文科技学院5门课程验收准备', sectionId: 'next_week' },
  { id: 'ex_nw_2', title: '贵州师范大学12门课程集中启动准备', sectionId: 'next_week' },
  { id: 'ex_nw_3', title: '离职同事课程对接推进建设进度', sectionId: 'next_week' },
];

/**
 * 智能分类任务到具体周报板块
 */
export function classifyTaskToSection(task: Task): { sectionId: string; subSectionId?: string } {
  const title = (task.title || '').toLowerCase();
  const desc = (task.desc || '').toLowerCase();
  const tags = (task.tags || []).map(t => t.toLowerCase());

  // 1. 优先通过 Tag 进行强匹配
  for (const section of REPORT_SECTIONS) {
    if (section.id === 'next_week') continue; // 下周工作通过排期/特殊标识判断
    for (const tag of section.tags) {
      if (tags.some(t => t.includes(tag.toLowerCase()))) {
        let subSectionId: string | undefined = undefined;
        if (section.hasSubsections && section.subsections) {
          subSectionId = matchSubsection(title + ' ' + desc, section.subsections);
        }
        return { sectionId: section.id, subSectionId };
      }
    }
  }

  // 2. 检查是否显式属于下周核心工作
  if (title.includes('下周') || tags.some(t => t.includes('下周'))) {
    return { sectionId: 'next_week' };
  }

  // 3. 关键词文本分析匹配
  for (const section of REPORT_SECTIONS) {
    if (section.id === 'next_week') continue;
    for (const kw of section.keywords) {
      const lowerKw = kw.toLowerCase();
      if (title.includes(lowerKw) || desc.includes(lowerKw)) {
        let subSectionId: string | undefined = undefined;
        if (section.hasSubsections && section.subsections) {
          subSectionId = matchSubsection(title + ' ' + desc, section.subsections);
        }
        return { sectionId: section.id, subSectionId };
      }
    }
  }

  // 4. 包含课程书名号《》且含“建课/新建”的进入新建AI课程
  if (title.includes('《') && title.includes('》') && (title.includes('建课') || title.includes('新建') || title.includes('开课'))) {
    return { sectionId: 'new_courses' };
  }

  // 5. 默认归入第十部分：售后服务及其他工作（日常运营）
  return { 
    sectionId: 'aftersales', 
    subSectionId: 'daily_ops' 
  };
}

function matchSubsection(text: string, subsections: ReportSubsectionDef[]): string {
  const lower = text.toLowerCase();
  for (const sub of subsections) {
    for (const kw of sub.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return sub.id;
      }
    }
  }
  return subsections[subsections.length - 1].id; // 默认日常运营
}

/**
 * 判断任务是否在指定起止日期范围内
 * 规范：
 * 1. 已完成任务：以 completedAt (实际完成时间) 为准！若无 completedAt，降级以 dueDate 为准；坚决不读取 updatedAt，避免多端同步或数据变更导致历史任务全部归并到当前周。
 * 2. 未完成任务：以 dueDate (排期截止时间) 为准。
 * 3. 自动将起止时间扩展为 startOfDay 和 endOfDay，确保全天范围覆盖无遗漏。
 */
export function isTaskInDateRange(
  task: Task, 
  start: Date, 
  end: Date, 
  options: { includeCompleted: boolean; includeDue: boolean; includeCreated?: boolean }
): boolean {
  const { includeCompleted, includeDue, includeCreated } = options;
  const rangeStart = startOfDay(start);
  const rangeEnd = endOfDay(end);

  // 1. 检查已完成任务 (优先 completedAt, 其次 dueDate)
  if (includeCompleted && task.completed) {
    if (task.completedAt) {
      try {
        const d = parseISO(task.completedAt);
        if (isValid(d) && isWithinInterval(d, { start: rangeStart, end: rangeEnd })) return true;
      } catch (e) { /* ignore */ }
    } else if (task.dueDate) {
      try {
        const d = parseISO(task.dueDate);
        if (isValid(d) && isWithinInterval(d, { start: rangeStart, end: rangeEnd })) return true;
      } catch (e) { /* ignore */ }
    }
  }

  // 2. 检查未完成但排期/截止在当前周期的任务
  if (includeDue && !task.completed && task.dueDate) {
    try {
      const d = parseISO(task.dueDate);
      if (isValid(d) && isWithinInterval(d, { start: rangeStart, end: rangeEnd })) return true;
    } catch (e) { /* ignore */ }
  }

  // 3. 检查创建时间
  if (includeCreated && task.createdAt) {
    try {
      const d = parseISO(task.createdAt);
      if (isValid(d) && isWithinInterval(d, { start: rangeStart, end: rangeEnd })) return true;
    } catch (e) { /* ignore */ }
  }

  return false;
}

/**
 * 获取某日所在周的周一 00:00:00 与周日 23:59:59
 */
export function getWeekRange(targetDate: Date = new Date(), weekOffset: number = 0) {
  const baseDate = weekOffset !== 0 ? addWeeks(targetDate, weekOffset) : targetDate;
  const start = startOfDay(startOfWeek(baseDate, { weekStartsOn: 1 }));
  const end = endOfDay(endOfWeek(baseDate, { weekStartsOn: 1 }));
  const isoWeek = getISOWeek(baseDate);
  const year = getYear(baseDate);

  return {
    start,
    end,
    isoWeek,
    year,
    startDateStr: format(start, 'yyyy-MM-dd'),
    endDateStr: format(end, 'yyyy-MM-dd'),
    displayLabel: `${year}年第${isoWeek}周 (${format(start, 'MM月dd日')} ~ ${format(end, 'MM月dd日')})`,
  };
}

export interface AvailableWeekOption {
  offset: number;
  year: number;
  isoWeek: number;
  start: Date;
  end: Date;
  displayLabel: string;
  shortLabel: string;
  taskCount: number;
  isCurrent: boolean;
}

/**
 * 扫描计算最近各周的历史任务数量，供周选择下拉菜单快捷切换使用
 */
export function getAvailableWeeksWithTaskCounts(
  tasks: Task[], 
  options: { includeCompleted: boolean; includeDue: boolean }
): AvailableWeekOption[] {
  const result: AvailableWeekOption[] = [];
  const baseDate = new Date();

  // 扫描过去 12 周到未来 1 周
  for (let offset = 1; offset >= -12; offset--) {
    const range = getWeekRange(baseDate, offset);
    const count = tasks.filter(t => 
      isTaskInDateRange(t, range.start, range.end, options)
    ).length;

    let relativeName = '';
    if (offset === 0) relativeName = ' · 本周';
    else if (offset === -1) relativeName = ' · 上周';

    result.push({
      offset,
      year: range.year,
      isoWeek: range.isoWeek,
      start: range.start,
      end: range.end,
      displayLabel: `${range.year}年第${range.isoWeek}周 (${format(range.start, 'MM/dd')}~${format(range.end, 'MM/dd')})${relativeName} [${count}项]`,
      shortLabel: `第${range.isoWeek}周 (${format(range.start, 'MM/dd')}~${format(range.end, 'MM/dd')})`,
      taskCount: count,
      isCurrent: offset === 0,
    });
  }

  return result;
}

/**
 * 将任务列表转换为周报条目
 */
export function convertTasksToReportItems(
  tasks: Task[], 
  weekRange: { start: Date; end: Date },
  options: { 
    includeCompleted: boolean; 
    includeDue: boolean; 
    enableRephrasing?: boolean 
  }
): ReportItem[] {
  const { includeCompleted, includeDue, enableRephrasing = true } = options;
  const currentWeekTasks = tasks.filter(t => 
    isTaskInDateRange(t, weekRange.start, weekRange.end, { includeCompleted, includeDue })
  );

  // 下周截止/排期的任务，自动提取至“下周核心工作”
  const nextWeekStart = addWeeks(weekRange.start, 1);
  const nextWeekEnd = addWeeks(weekRange.end, 1);
  const nextWeekTasks = tasks.filter(t => 
    !t.completed && t.dueDate && isTaskInDateRange(t, nextWeekStart, nextWeekEnd, { includeCompleted: false, includeDue: true })
  );

  const items: ReportItem[] = [];

  // 添加本周任务
  for (const t of currentWeekTasks) {
    const { sectionId, subSectionId } = classifyTaskToSection(t);
    let cleanTitle = t.title.replace(/#\S+/g, '').trim();
    if (!cleanTitle) cleanTitle = t.title;

    const meta = extractTaskMetadata(cleanTitle, t.desc);
    const rephrased = enableRephrasing
      ? rephraseTaskToReportLanguage(cleanTitle, sectionId, t.desc)
      : cleanTitle;

    items.push({
      id: `rep_${t.id}`,
      title: rephrased || cleanTitle,
      rawTitle: t.title,
      school: meta.school,
      course: meta.course,
      action: meta.actionText,
      sourceTaskId: t.id,
      sectionId,
      subSectionId,
    });
  }

  // 添加自动提取的下周任务
  for (const t of nextWeekTasks) {
    let cleanTitle = t.title.replace(/#\S+/g, '').trim();
    if (!cleanTitle) cleanTitle = t.title;

    // 避免重复
    if (!items.some(i => i.sourceTaskId === t.id)) {
      const meta = extractTaskMetadata(cleanTitle, t.desc);
      const rephrased = enableRephrasing
        ? rephraseTaskToReportLanguage(cleanTitle, 'next_week', t.desc)
        : cleanTitle;

      items.push({
        id: `rep_next_${t.id}`,
        title: rephrased || cleanTitle,
        rawTitle: t.title,
        school: meta.school,
        course: meta.course,
        action: meta.actionText,
        sourceTaskId: t.id,
        sectionId: 'next_week',
      });
    }
  }

  return items;
}

export type ExportFormatStyle = 'standard' | 'markdown' | 'compact';

export interface GenerateReportOptions {
  withNumbering?: boolean; // 是否自动加上 1. 2. 3. 序号，默认为 true
}

/**
 * 格式化任务文本：自动换行并支持添加 1.、2.、3. 序号
 */
export function formatItemTitle(rawTitle: string, index: number, withNumbering: boolean = true): string {
  const trimmed = rawTitle.trim();
  if (!trimmed) return '';
  // 单独的占位符（如 "-" 或 "-售前表格截图:"）不添加序号
  if (trimmed === '-' || trimmed.startsWith('-售前表格截图')) return trimmed;

  if (withNumbering) {
    // 移除已有的前置标号，防止重复出现 "1. 1. xxx" 或 "1. - xxx"
    const cleaned = trimmed.replace(/^\d+[\.、\s]+/, '').replace(/^[-*•\s]+/, '').trim();
    return `${index + 1}. ${cleaned}`;
  }
  return trimmed;
}

/**
 * 生成符合用户模板的周报文本 (支持每个任务自动换行并加 1. 2. 3. 序号)
 */
export function generateWeeklyReportContent(
  items: ReportItem[], 
  style: ExportFormatStyle = 'standard',
  options: GenerateReportOptions = { withNumbering: true }
): string {
  const { withNumbering = true } = options;
  const lines: string[] = [];

  for (const section of REPORT_SECTIONS) {
    const sectionItems = items.filter(i => i.sectionId === section.id);

    // Section 标题
    lines.push(section.title);

    // 处理无内容时的默认占位符
    if (sectionItems.length === 0) {
      if (section.defaultPlaceholder) {
        lines.push(section.defaultPlaceholder);
      } else if (section.id === 'next_week') {
        // 下周工作如果为空，给一个默认提示占位
        lines.push('下周核心工作推进准备');
      }
      continue;
    }

    // 处理有子项的板块 (如：十、售后服务及其他工作)
    if (section.hasSubsections && section.subsections) {
      for (const sub of section.subsections) {
        const subItems = sectionItems.filter(i => i.subSectionId === sub.id);
        if (subItems.length > 0) {
          if (style === 'markdown') {
            lines.push(`### ${sub.title}`);
            subItems.forEach((item, idx) => {
              const formatted = formatItemTitle(item.title, idx, withNumbering);
              if (formatted) lines.push(withNumbering ? formatted : `- ${formatted}`);
            });
          } else {
            // 标准模板样式：每个子板块标题单独一行，子任务逐行自动换行并带 1. 2. 3. 序号
            lines.push(sub.title);
            subItems.forEach((item, idx) => {
              const formatted = formatItemTitle(item.title, idx, withNumbering);
              if (formatted) lines.push(formatted);
            });
          }
        }
      }

      // 未匹配到具体子项的条目
      const unclassified = sectionItems.filter(i => !i.subSectionId);
      if (unclassified.length > 0) {
        if (style === 'markdown') {
          lines.push(`### 日常运营、资源挂载与数据维护：`);
          unclassified.forEach((item, idx) => {
            const formatted = formatItemTitle(item.title, idx, withNumbering);
            if (formatted) lines.push(withNumbering ? formatted : `- ${formatted}`);
          });
        } else {
          lines.push('日常运营、资源挂载与数据维护：');
          unclassified.forEach((item, idx) => {
            const formatted = formatItemTitle(item.title, idx, withNumbering);
            if (formatted) lines.push(formatted);
          });
        }
      }
      continue;
    }

    // 普通板块条目渲染：逐行换行并自动加上 1. 2. 3. 序号
    sectionItems.forEach((item, idx) => {
      const trimmed = item.title.trim();
      if (!trimmed) return;

      if (style === 'markdown') {
        const formatted = formatItemTitle(trimmed, idx, withNumbering);
        lines.push(withNumbering ? formatted : `- ${formatted}`);
      } else {
        const formatted = formatItemTitle(trimmed, idx, withNumbering);
        lines.push(formatted);
      }
    });
  }

  return lines.join('\n');
}

/**
 * 复制文本到剪贴板
 */
export async function copyReportToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.error('navigator.clipboard failed, fallback to execCommand', err);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('execCommand copy failed', err);
    return false;
  }
}

/**
 * 导出并触发浏览器下载文件
 */
export function downloadReportFile(filename: string, content: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
