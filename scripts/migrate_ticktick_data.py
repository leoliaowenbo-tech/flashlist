#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import sqlite3
import json
from datetime import datetime, timedelta, timezone

EPOCH_UTC = datetime(2001, 1, 1, tzinfo=timezone.utc)
TZ_LOCAL = timezone(timedelta(hours=8)) # 北京时间 UTC+8
CUTOFF_SEC = (datetime(2026, 8, 15, tzinfo=TZ_LOCAL) - EPOCH_UTC).total_seconds()

SRC_DB = "/Users/wenbo/Desktop/OSXCoreDataObjC.storedata"
DST_DB = "/Users/wenbo/Library/WebKit/com.flashlist.desktop.mac/WebsiteData/Default/-Osd2FdsQf-hvS73O0_qXkOlDl0YbIyOXBvRfFMGtz8/-Osd2FdsQf-hvS73O0_qXkOlDl0YbIyOXBvRfFMGtz8/LocalStorage/localstorage.sqlite3"

def apple_sec_to_datetime(sec):
    if sec is None:
        return None
    try:
        dt_utc = EPOCH_UTC + timedelta(seconds=float(sec))
        return dt_utc.astimezone(TZ_LOCAL)
    except Exception:
        return None

def migrate():
    print("=== 开始从滴答清单提取近两个月任务数据 ===")
    conn_src = sqlite3.connect(SRC_DB)
    cur_src = conn_src.cursor()

    # 1. 提取所有子任务 (Checklist Items)
    cur_src.execute("""
    SELECT ZTASK, ZTITLE, ZSTATUS, ZSORTORDER 
    FROM ZTTCHECKLISTITEM 
    ORDER BY ZTASK, ZSORTORDER;
    """)
    checklist_by_task = {}
    checklist_count = 0
    for r in cur_src.fetchall():
        task_pk, sub_title, sub_status, sort_order = r
        if not sub_title:
            continue
        sub_list = checklist_by_task.setdefault(task_pk, [])
        sub_list.append({
            'id': f"sub_{task_pk}_{len(sub_list)}_{sort_order}",
            'title': sub_title.strip(),
            'completed': (sub_status == 2)
        })
        checklist_count += 1
    print(f"提取到子任务 Checklist 项: {checklist_count} 条")

    # 2. 提取清单 (Projects)
    cur_src.execute("SELECT Z_PK, ZNAME, ZCOLOR, ZISINBOX FROM ZTTPROJECT;")
    projects_map = {}
    for r in cur_src.fetchall():
        pk, name, color, is_inbox = r
        projects_map[pk] = {
            'id': 'inbox' if is_inbox else f"list_{pk}",
            'name': name or '收集箱',
            'color': color or '#3B82F6'
        }

    # 3. 提取任务 (Tasks)
    cur_src.execute("""
    SELECT 
        Z_PK, ZTITLE, ZCONTENT, ZPRIORITY, ZSTATUS, 
        ZSTRINGOFTAGS, ZALLDAY, ZSTARTDATE, ZENDDATE, 
        ZCREATIONDATE, ZCOMPLETIONDATE, ZPROJECT
    FROM ZTTTASK
    WHERE ZDELETIONSTATUS = 0
      AND (
        ZSTATUS = 0 
        OR ZSTARTDATE >= ? 
        OR ZCOMPLETIONDATE >= ? 
        OR ZCREATIONDATE >= ?
      )
    ORDER BY ZSTARTDATE DESC, ZCREATIONDATE DESC;
    """, (CUTOFF_SEC, CUTOFF_SEC, CUTOFF_SEC))

    tasks = []
    tags_stat = set()
    uncompleted_count = 0
    completed_count = 0

    for r in cur_src.fetchall():
        (pk, title, content, prio, status, 
         raw_tags, allday, start_sec, end_sec, 
         create_sec, comp_sec, proj_pk) = r

        if not title:
            continue

        completed = (status == 2)
        if completed:
            completed_count += 1
        else:
            uncompleted_count += 1

        # 优先级映射: 5:高(p1), 3:中(p2), 1:低(p3), 0:无(p4)
        priority = 'p4'
        if prio == 5:
            priority = 'p1'
        elif prio == 3:
            priority = 'p2'
        elif prio == 1:
            priority = 'p3'

        # 日期与时间转换
        due_date = None
        due_time = None
        if start_sec is not None:
            dt = apple_sec_to_datetime(start_sec)
            if dt:
                due_date = dt.strftime('%Y-%m-%d')
                if allday == 0 and (dt.hour != 0 or dt.minute != 0):
                    due_time = dt.strftime('%H:%M')

        # 创建与完成时间
        create_dt = apple_sec_to_datetime(create_sec) or datetime.now(TZ_LOCAL)
        comp_dt = apple_sec_to_datetime(comp_sec)

        # 标签解析
        task_tags = []
        if raw_tags:
            for t in raw_tags.split(','):
                t_clean = t.strip().lstrip('#')
                if t_clean:
                    task_tags.append(t_clean)
                    tags_stat.add(t_clean)

        # 清单归属
        list_id = 'inbox'
        if proj_pk in projects_map:
            list_id = projects_map[proj_pk]['id']

        # 子任务关联
        subtasks = checklist_by_task.get(pk, [])

        task_obj = {
            'id': f"tick_{pk}",
            'title': title.strip(),
            'desc': (content or '').strip(),
            'completed': completed,
            'priority': priority,
            'dueDate': due_date,
            'dueTime': due_time,
            'listId': list_id,
            'tags': task_tags,
            'subtasks': subtasks,
            'createdAt': create_dt.isoformat(),
            'updatedAt': datetime.now(TZ_LOCAL).isoformat(),
            'completedAt': comp_dt.isoformat() if comp_dt else None
        }
        tasks.append(task_obj)

    conn_src.close()

    print(f"提取完成！近两个月任务总计: {len(tasks)} 条")
    print(f" - 未完成任务: {uncompleted_count} 条")
    print(f" - 已完成任务: {completed_count} 条")
    print(f" - 包含业务标签 ({len(tags_stat)} 个): {sorted(list(tags_stat))}")

    # 4. 准备清单分类
    custom_lists = [
        {'id': 'work', 'name': '工作项目', 'color': '#3B82F6'},
        {'id': 'demand', 'name': '需求', 'color': '#F59E0B'},
        {'id': 'life', 'name': '生活日常', 'color': '#10B981'},
        {'id': 'learning', 'name': '技能进阶', 'color': '#8B5CF6'},
    ]
    for pk, p in projects_map.items():
        if p['id'] != 'inbox' and not any(l['id'] == p['id'] for l in custom_lists):
            custom_lists.append(p)

    # 将所有包含“需求”的任务移入“需求”清单
    for t in tasks:
        if '需求' in t.get('title', ''):
            t['listId'] = 'demand'

    # 5. 写入闪念清单 WebKit LocalStorage 数据库 (UTF-16LE BLOB)
    print(f"=== 写入闪念清单数据库: {DST_DB} ===")
    tasks_json = json.dumps(tasks, ensure_ascii=False)
    lists_json = json.dumps(custom_lists, ensure_ascii=False)

    tasks_blob = tasks_json.encode('utf-16le')
    lists_blob = lists_json.encode('utf-16le')

    conn_dst = sqlite3.connect(DST_DB)
    cur_dst = conn_dst.cursor()

    cur_dst.execute("REPLACE INTO ItemTable (key, value) VALUES (?, ?);", ('ticktick_clone_tasks', tasks_blob))
    cur_dst.execute("REPLACE INTO ItemTable (key, value) VALUES (?, ?);", ('ticktick_clone_lists', lists_blob))

    conn_dst.commit()
    conn_dst.close()

    # 移除可能存在的 WAL 缓存文件，确保主库生效
    for ext in ['-wal', '-shm']:
        wal_file = DST_DB + ext
        if os.path.exists(wal_file):
            try:
                os.remove(wal_file)
            except Exception:
                pass

    print("✅ 数据写入成功！正在重启「闪念清单」桌面应用...")
    os.system("pkill -f 'FlashList' 2>/dev/null; sleep 0.5; open /Applications/闪念清单.app")
    print("🎉 同步全部完成！")

if __name__ == '__main__':
    migrate()
