# 闪念清单 (FlashList) · 手机端与云端双向同步配置指南

本项目已为你全面升级为 **“离线优先 + 实时云端同步 + 移动端 PWA”** 架构，单人使用完全在免费额度内，无需服务器租赁费用。

---

## 🚀 三步快速开通 (耗时约 3 分钟)

### 第一步：在 Supabase 创建免费数据库 (只需 1 分钟)
1. 打开 [https://supabase.com](https://supabase.com) 并登录/注册（免费计划）。
2. 点击 **“New project”**，填入任意项目名（例如 `flashlist`），设置一个数据库密码并选择区域（如 `Singapore` 或 `Tokyo`），点击创建。
3. 等待项目初始化完毕后，点击左侧栏的 **“SQL Editor”** → 点击 **“New query”**。
4. 打开项目根目录下的 [`supabase_schema.sql`](./supabase_schema.sql)（或直接在应用设置弹窗的“一键初始化 SQL”中点击复制），将全部内容粘贴进去，点击右下角 **“Run”**。
   > 看到 Success 即表示 `tasks`、`task_lists`、`tag_rules` 表已建好，且实时推送通道 (Realtime) 已激活！

---

### 第二步：获取密钥并填入清单应用
1. 在 Supabase 控制台左下角点击 **Project Settings** (齿轮图标) → **API**。
2. 复制两项参数：
   * **Project URL**（形如 `https://xxxx.supabase.co`）
   * **Project API keys** 下的 **anon / public** 密钥（长串以 `eyJ...` 开头）
3. 打开电脑上的 **“闪念清单” Mac 客户端**（或浏览器网页）：
   * 点击右上角的 **“多端同步”** 按钮。
   * 将 URL 和 anon key 粘贴进去，点击 **“测试连接”**。
   * 测试通过后点击 **“保存并连接”**。此时电脑端右上角会显示绿色小圆点 **“云同步已连接”**，历史任务会自动同步到云端。

---

### 第三步：手机端使用方式 (PWA 添加到桌面)

#### 方式 A：局域网快速体验（手机和电脑连接同一个 Wi-Fi）
1. 在终端运行：
   ```bash
   npm run dev -- --host
   ```
2. 终端会打印出类似 `http://192.168.1.x:5173/` 的网络地址。
3. 手机连接同一 Wi-Fi，打开该地址。
4. 在手机右上角/底部点击“多端同步”，填入相同的 Supabase URL 和 anon key 即可。

#### 方式 B：全天候随时随地使用（推荐 · 免费部署到 Vercel / Cloudflare Pages）
若希望手机出门在外（使用蜂窝移动网络）也能随时记录并同步：
1. 将当前代码推送至你的 GitHub 仓库（私有仓库即可）。
2. 登录 [Vercel](https://vercel.com) 或 [Cloudflare Pages](https://pages.cloudflare.com/)，一键导入该 GitHub 仓库，点击 Deploy。
3. 部署完成后会得到一个免费专属 HTTPS 域名（如 `https://flashlist-myname.vercel.app`）。
4. **添加到手机主屏幕**：
   * **iPhone (Safari)**：打开该网址，点击底部“分享”按钮（带箭头的方框）→ 选择 **“添加到主屏幕”**。
   * **Android (Chrome)**：打开网址，点击右上角菜单 → 选择 **“安装应用”** 或 **“添加到主屏幕”**。
5. 手机桌面上会生成独立的“闪念清单”图标，全屏无边框运行，打开即可秒级录入、语音输入！
