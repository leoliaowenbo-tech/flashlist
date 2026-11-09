-- =======================================================
-- 闪念清单 (FlashList) Supabase 安全与多端实时同步初始化脚本
-- 支持：
-- 1. 邮箱密码安全登录 (Row Level Security 按用户隔离)
-- 2. 单人免登录兼容模式 (当 user_id 为空时仍可平滑升级)
-- 3. 实时推送 (Supabase Realtime) 零延迟同步到 iPhone 与 Mac
-- =======================================================

-- 1. 创建任务表 (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'p4',
    due_date TEXT,
    due_time TEXT,
    list_id TEXT DEFAULT 'inbox',
    tags JSONB DEFAULT '[]'::jsonb,
    subtasks JSONB DEFAULT '[]'::jsonb,
    pinned BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    reminder TEXT
);

-- 兼容旧表升级：补充 user_id 字段
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

-- 2. 创建清单分类表 (task_lists)
CREATE TABLE IF NOT EXISTS public.task_lists (
    id TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT,
    folder_id TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.task_lists ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

-- 3. 创建自动打标规则表 (tag_rules)
CREATE TABLE IF NOT EXISTS public.tag_rules (
    tag TEXT PRIMARY KEY,
    user_id UUID DEFAULT auth.uid(),
    keywords JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tag_rules ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid();

-- 4. 开启行级安全策略 (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_rules ENABLE ROW LEVEL SECURITY;

-- 清理旧策略
DROP POLICY IF EXISTS "Anon All Tasks" ON public.tasks;
DROP POLICY IF EXISTS "Anon All Task Lists" ON public.task_lists;
DROP POLICY IF EXISTS "Anon All Tag Rules" ON public.tag_rules;
DROP POLICY IF EXISTS "User Isolated Tasks" ON public.tasks;
DROP POLICY IF EXISTS "User Isolated Task Lists" ON public.task_lists;
DROP POLICY IF EXISTS "User Isolated Tag Rules" ON public.tag_rules;

-- 创建安全策略：
-- 已登录用户只能读写自己 user_id 的数据（或认领 user_id 为 NULL 的存量数据）
CREATE POLICY "User Isolated Tasks" ON public.tasks
    FOR ALL
    TO authenticated, anon
    USING (user_id IS NULL OR user_id = auth.uid())
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "User Isolated Task Lists" ON public.task_lists
    FOR ALL
    TO authenticated, anon
    USING (user_id IS NULL OR user_id = auth.uid())
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "User Isolated Tag Rules" ON public.tag_rules
    FOR ALL
    TO authenticated, anon
    USING (user_id IS NULL OR user_id = auth.uid())
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 5. 开启 Supabase Realtime 实时推送（手机端一修改，电脑端零延迟响应）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'task_lists'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_lists;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tag_rules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tag_rules;
    END IF;
END $$;

-- 6. 创建索引加速排序与增量同步查询
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON public.tasks (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON public.tasks (is_deleted);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks (user_id);
