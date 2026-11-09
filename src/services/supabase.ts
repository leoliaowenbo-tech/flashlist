import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

  // 2. 尝试从 Vite 环境变量读取
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
        persistSession: false,
        autoRefreshToken: false,
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

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    const testClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await testClient.from('tasks').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: '连接到 Supabase 成功，但未找到 tasks 数据表！请在 Supabase SQL Editor 中执行初始化脚本。',
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
