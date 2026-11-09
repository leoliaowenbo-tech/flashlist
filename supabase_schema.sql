-- =======================================================
-- 闪念清单 (FlashList) Supabase 快速初始化脚本
-- 在 Supabase 控制台的 SQL Editor 中粘贴运行即可 (运行耗时约 2 秒)
-- =======================================================

-- 1. 创建任务表 (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id TEXT PRIMARY KEY,
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

-- 2. 创建清单分类表 (task_lists)
CREATE TABLE IF NOT EXISTS public.task_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT,
    folder_id TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建自动打标规则表 (tag_rules)
CREATE TABLE IF NOT EXISTS public.tag_rules (
    tag TEXT PRIMARY KEY,
    keywords JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 开启行级安全策略 (RLS) 并允许匿名密钥 (anon) 读写（单人免登录模式）
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon All Tasks" ON public.tasks;
CREATE POLICY "Anon All Tasks" ON public.tasks FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon All Task Lists" ON public.task_lists;
CREATE POLICY "Anon All Task Lists" ON public.task_lists FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon All Tag Rules" ON public.tag_rules;
CREATE POLICY "Anon All Tag Rules" ON public.tag_rules FOR ALL TO anon USING (true) WITH CHECK (true);

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

-- 6. 创建索引加速排序查询
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON public.tasks (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks (due_date ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON public.tasks (is_deleted);
