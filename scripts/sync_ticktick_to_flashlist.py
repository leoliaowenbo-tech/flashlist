#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
同步滴答清单数据到闪念清单 (FlashList)
支持两类数据源：
1. 滴答清单官方导出的 CSV 文件 (Downloads 或 Desktop 中的 TickTick-backup*.csv)
2. 滴答清单本地 CoreData 数据库文件 (OSXCoreDataObjC.storedata)
"""

import os
import sys
import glob
import sqlite3
import json
import csv
from datetime import datetime, timedelta

LOCAL_STORAGE_DB = "/Users/wenbo/Library/WebKit/com.flashlist.desktop.mac/WebsiteData/Default/-Osd2FdsQf-hvS73O0_qXkOlDl0YbIyOXBvRfFMGtz8/-Osd2FdsQf-hvS73O0_qXkOlDl0YbIyOXBvRfFMGtz8/LocalStorage/localstorage.sqlite3"
CUTOFF_DATE = datetime.now() - timedelta(days=62) # 近两个月
APPLE_EPOCH = datetime(2001, 1, 1)

def apple_ts_to_datetime(ts):
    if not ts:
        return None
    try:
        return APPLE_EPOCH + timedelta(seconds=float(ts))
    except Exception:
        return None

def find_data_source():
    # 查找下载或桌面中的 CSV 文件
    csv_candidates = glob.glob(os.path.expanduser("~/Downloads/*ticktick*.csv")) + \
                     glob.glob(os.path.expanduser("~/Downloads/*dida*.csv")) + \
                     glob.glob(os.path.expanduser("~/Downloads/*滴答*.csv")) + \
                     glob.glob(os.path.expanduser("~/Desktop/*ticktick*.csv")) + \
                     glob.glob(os.path.expanduser("~/Desktop/*滴答*.csv"))
    if csv_candidates:
        return ('csv', csv_candidates[0])

    # 查找下载、桌面或 /tmp 中的 storedata
    db_candidates = [
        os.path.expanduser("~/Downloads/OSXCoreDataObjC.storedata"),
        os.path.expanduser("~/Desktop/OSXCoreDataObjC.storedata"),
        "/tmp/OSXCoreDataObjC.storedata"
    ]
    for c in db_candidates:
        if os.path.exists(c):
            return ('sqlite', c)

    return (None, None)

def parse_sqlite_file(db_path):
    print(f"正在从 SQLite 数据库提取: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [r[0] for r in cur.fetchall()]

    task_table = next((t for t in tables if 'task' in t.lower() and not 'sync' in t.lower()), None)
    project_table = next((t for t in tables if 'project' in t.lower()), None)

    projects_map = {}
    if project_table:
        cur.execute(f"PRAGMA table_info({project_table});")
        pcols = [r[1] for r in cur.fetchall()]
        name_col = next((c for c in pcols if 'name' in c.lower()), None)
        id_col = next((c for c in pcols if 'id' in c.lower() or c == 'Z_PK'), pcols[0])
        color_col = next((c for c in pcols if 'color' in c.lower()), None)

        cur.execute(f"SELECT * FROM {project_table};")
        for row in cur.fetchall():
            row_dict = dict(zip(pcols, row))
            pid = str(row_dict.get(id_col))
            pname = row_dict.get(name_col) or '自定义清单'
            pcolor = row_dict.get(color_col) or '#3B82F6'
            projects_map[pid] = {'id': f"list_{pid}", 'name': pname, 'color': pcolor}

    tasks = []
    if task_table:
        cur.execute(f"PRAGMA table_info({task_table});")
        tcols = [r[1] for r in cur.fetchall()]
        title_col = next((c for c in tcols if 'title' in c.lower()), 'ZTITLE')
        desc_col = next((c for c in tcols if 'content' in c.lower() or 'desc' in c.lower()), None)
        due_col = next((c for c in tcols if 'duedate' in c.lower() or 'startdate' in c.lower()), None)
        status_col = next((c for c in tcols if 'status' in c.lower()), None)
        priority_col = next((c for c in tcols if 'priority' in c.lower()), None)
        created_col = next((c for c in tcols if 'created' in c.lower()), None)
        proj_col = next((c for c in tcols if 'project' in c.lower()), None)
        tags_col = next((c for c in tcols if 'tag' in c.lower()), None)

        cur.execute(f"SELECT * FROM {task_table};")
        for row in cur.fetchall():
            row_dict = dict(zip(tcols, row))
            title = str(row_dict.get(title_col) or '').strip()
            if not title:
                continue

            desc = str(row_dict.get(desc_col) or '')
            raw_due = row_dict.get(due_col)
            raw_status = row_dict.get(status_col)
            raw_prio = row_dict.get(priority_col)
            raw_created = row_dict.get(created_col)
            proj_id = str(row_dict.get(proj_col) or '')

            completed = bool(raw_status == 1 or raw_status == 2)
            due_dt = apple_ts_to_datetime(raw_due)
            created_dt = apple_ts_to_datetime(raw_created) or datetime.now()

            # 过滤近2个月的任务
            if completed and (due_dt or created_dt):
                ref_dt = due_dt or created_dt
                if ref_dt < CUTOFF_DATE:
                    continue

            # 优先级
            prio = 'p4'
            if raw_prio == 5: prio = 'p1'
            elif raw_prio == 3: prio = 'p2'
            elif raw_prio == 1: prio = 'p3'

            list_id = 'inbox'
            if proj_id in projects_map:
                list_id = projects_map[proj_id]['id']

            due_date = due_dt.strftime('%Y-%m-%d') if due_dt else None
            due_time = due_dt.strftime('%H:%M') if (due_dt and (due_dt.hour != 0 or due_dt.minute != 0)) else None

            tasks.append({
                'id': f"tick_{len(tasks)}_{os.urandom(3).hex()}",
                'title': title,
                'desc': desc,
                'completed': completed,
                'priority': prio,
                'dueDate': due_date,
                'dueTime': due_time,
                'listId': list_id,
                'tags': [],
                'subtasks': [],
                'createdAt': created_dt.isoformat(),
                'updatedAt': datetime.now().isoformat(),
            })

    conn.close()
    return tasks, list(projects_map.values())

def parse_csv_file(file_path):
    print(f"正在解析 CSV 备份: {file_path}")
    tasks = []
    lists_map = {}
    tags_set = set()

    color_palette = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4']
    color_idx = 0

    with open(file_path, 'r', encoding='utf-8-sig', errors='ignore') as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get('Title') or row.get('title') or '').strip()
            if not title:
                continue

            list_name = (row.get('List Name') or row.get('list name') or '收集箱').strip()
            raw_tags = (row.get('Tags') or row.get('tags') or '').strip()
            raw_content = (row.get('Content') or row.get('content') or '').strip()
            raw_due = (row.get('Due Date') or row.get('due date') or '').strip()
            raw_priority = (row.get('Priority') or row.get('priority') or '0').strip()
            raw_status = (row.get('Status') or row.get('status') or '0').strip()
            raw_created = (row.get('Created Time') or row.get('created time') or '').strip()
            raw_completed = (row.get('Completed Time') or row.get('completed time') or '').strip()

            priority = 'p4'
            if raw_priority in ['5', '高', 'High', 'high']:
                priority = 'p1'
            elif raw_priority in ['3', '中', 'Medium', 'medium']:
                priority = 'p2'
            elif raw_priority in ['1', '低', 'Low', 'low']:
                priority = 'p3'

            completed = raw_status in ['1', 'Completed', 'completed', '已完成']

            due_date = None
            due_time = None
            task_dt = None

            if raw_due:
                for fmt in ['%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d']:
                    try:
                        clean_str = raw_due.split('+')[0].strip()
                        task_dt = datetime.strptime(clean_str, fmt.split('%z')[0].strip())
                        due_date = task_dt.strftime('%Y-%m-%d')
                        if task_dt.hour != 0 or task_dt.minute != 0:
                            due_time = task_dt.strftime('%H:%M')
                        break
                    except Exception:
                        pass

            created_at = datetime.now().isoformat()
            if raw_created:
                for fmt in ['%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d']:
                    try:
                        clean_str = raw_created.split('+')[0].strip()
                        cdt = datetime.strptime(clean_str, fmt.split('%z')[0].strip())
                        created_at = cdt.isoformat()
                        if not task_dt:
                            task_dt = cdt
                        break
                    except Exception:
                        pass

            if completed and task_dt:
                if task_dt < CUTOFF_DATE:
                    continue

            list_id = 'inbox'
            if list_name and list_name not in ['收集箱', 'Inbox']:
                list_id = f"list_{list_name}"
                if list_id not in lists_map:
                    lists_map[list_id] = {
                        'id': list_id,
                        'name': list_name,
                        'color': color_palette[color_idx % len(color_palette)]
                    }
                    color_idx += 1

            tags = []
            if raw_tags:
                tags = [t.strip().lstrip('#') for t in raw_tags.replace(',', ' ').split() if t.strip()]
                for t in tags:
                    tags_set.add(t)

            subtasks = []
            desc_lines = []
            for line in raw_content.splitlines():
                line_str = line.strip()
                if line_str.startswith('- [ ]') or line_str.startswith('- [x]') or line_str.startswith('- [X]'):
                    is_sub_done = line_str.startswith('- [x]') or line_str.startswith('- [X]')
                    sub_title = line_str[5:].strip()
                    subtasks.append({
                        'id': f"sub_{len(subtasks)}_{os.urandom(2).hex()}",
                        'title': sub_title,
                        'completed': is_sub_done
                    })
                else:
                    desc_lines.append(line)

            task_obj = {
                'id': f"tick_{len(tasks)}_{os.urandom(3).hex()}",
                'title': title,
                'desc': '\n'.join(desc_lines).strip(),
                'completed': completed,
                'priority': priority,
                'dueDate': due_date,
                'dueTime': due_time,
                'listId': list_id,
                'tags': tags,
                'subtasks': subtasks,
                'createdAt': created_at,
                'updatedAt': datetime.now().isoformat(),
                'completedAt': raw_completed if completed else None
            }
            tasks.append(task_obj)

    return tasks, list(lists_map.values())

def inject_to_flashlist(tasks, lists):
    if not os.path.exists(LOCAL_STORAGE_DB):
        print(f"Error: 闪念清单数据库不存在: {LOCAL_STORAGE_DB}")
        return False

    conn = sqlite3.connect(LOCAL_STORAGE_DB)
    cur = conn.cursor()

    tasks_json = json.dumps(tasks, ensure_ascii=False).encode('utf-8')
    lists_json = json.dumps(lists, ensure_ascii=False).encode('utf-8')

    cur.execute("REPLACE INTO ItemTable (key, value) VALUES (?, ?);", ('ticktick_clone_tasks', tasks_json))
    cur.execute("REPLACE INTO ItemTable (key, value) VALUES (?, ?);", ('ticktick_clone_lists', lists_json))

    conn.commit()
    conn.close()
    print("✅ 成功写入闪念清单数据库！")

    # 重启闪念清单以刷新数据
    os.system("pkill -f 'FlashList' 2>/dev/null; sleep 0.5; open /Applications/闪念清单.app")
    return True

if __name__ == '__main__':
    stype, spath = find_data_source()
    if not stype:
        print("WAITING_FOR_DATA: 未检测到备份文件或数据库")
        sys.exit(1)

    if stype == 'csv':
        tasks, lists = parse_csv_file(spath)
        print(f"成功解析 {len(tasks)} 条近两个月任务，{len(lists)} 个自定义清单！")
        inject_to_flashlist(tasks, lists)
        print("ALL_DONE")
    elif stype == 'sqlite':
        tasks, lists = parse_sqlite_file(spath)
        print(f"成功提取 {len(tasks)} 条近两个月任务，{len(lists)} 个自定义清单！")
        inject_to_flashlist(tasks, lists)
        print("ALL_DONE")
