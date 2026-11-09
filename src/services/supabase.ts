import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { SyncConfig } from '../types/sync';

const STORAGE_KEY_CONFIG = 'flashlist_supabase_config';

let clientInstance: SupabaseClient | null = null;
let currentConfig: SyncConfig | null = null;

export function getSupabaseConfig(): SyncConfig {
  if (currentConfig) return currentConfig;

  // 1. 尝试从 localStorage 读取
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
        currentConfig = parsed;
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  // 2. 尝试从 URL 参数读取 (?sync_url=...&sync_key=...) 方便手机扫码/一键导入配置
  try {
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('sync_url');
      const keyParam = params.get('sync_key');
      if (urlParam && keyParam) {
        const autoConfig: SyncConfig = {
          supabaseUrl: urlParam.trim(),
          supabaseAnonKey: keyParam.trim(),
          enabled: true,
          lastSyncedAt: null,
        };
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(autoConfig));
        // 清理 URL 参数，保持地址栏干净
        const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
        currentConfig = autoConfig;
        return autoConfig;
      }
    }
  } catch (e) {
    // ignore
  }

  // 3. 尝试从 Vite 环境变量读取
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  currentConfig = {
    supabaseUrl: envUrl,
    supabaseAnonKey: envKey,
    enabled: Boolean(envUrl && envKey),
    lastSyncedAt: null,
  };

  return currentConfig;
}

export function saveSupabaseConfig(config: SyncConfig): void {
  currentConfig = config;
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  // 重新创建 client 实例
  clientInstance = null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  const config = getSupabaseConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.enabled) {
    return null;
  }

  try {
    clientInstance = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'flashlist_auth_token',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return clientInstance;
  } catch (err) {
    console.error('初始化 Supabase 客户端失败:', err);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data?.session?.user ?? null;
  } catch {
    return null;
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User | null; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: '请先配置并保存 Supabase URL 和 Anon Key' };
  }
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { success: false, message: `登录失败: ${error.message}` };
    }
    const cfg = getSupabaseConfig();
    cfg.userEmail = data.user?.email || email.trim();
    saveSupabaseConfig(cfg);
    return {
      success: true,
      user: data.user,
      message: `已成功登录账号：${data.user?.email}`,
    };
  } catch (e: any) {
    return { success: false, message: `登录异常: ${e.message || String(e)}` };
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User | null; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: '请先配置并保存 Supabase URL 和 Anon Key' };
  }
  try {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      return { success: false, message: `注册失败: ${error.message}` };
    }
    if (data.session) {
      const cfg = getSupabaseConfig();
      cfg.userEmail = data.user?.email || email.trim();
      saveSupabaseConfig(cfg);
      return {
        success: true,
        user: data.user,
        message: `注册并登录成功！你的专属加密同步账号已激活。`,
      };
    }
    return {
      success: true,
      user: data.user,
      message:
        '注册请求已提交！如果收到了验证邮件请点击确认（或在 Supabase 后台 Authentication -> Providers -> Email 中关闭 Confirm email 即可直接登录）。',
    };
  } catch (e: any) {
    return { success: false, message: `注册异常: ${e.message || String(e)}` };
  }
}

export async function signOutAccount(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch {
      // ignore
    }
  }
  const cfg = getSupabaseConfig();
  cfg.userEmail = null;
  saveSupabaseConfig(cfg);
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    const testClient = createClient(url, anonKey, {
      auth: { persistSession: true, storageKey: 'flashlist_auth_token' },
    });
    const { error } = await testClient.from('tasks').select('id').limit(1);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return {
          success: false,
          message:
            '连接到 Supabase 成功，但未找到 tasks 数据表！请切换到上方「一键初始化 SQL」复制并在 Supabase SQL Editor 中运行。',
        };
      }
      return {
        success: false,
        message: `连接失败: ${error.message} (${error.code || ''})`,
      };
    }

    return {
      success: true,
      message: '测试连接成功！数据表正常且就绪。',
    };
  } catch (e: any) {
    return {
      success: false,
      message: `网络或参数错误: ${e.message || String(e)}`,
    };
  }
}
