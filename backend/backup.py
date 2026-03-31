#!/usr/bin/env python3
"""
审核数据备份模块
功能：
1. 备份数据库到 backups/ 目录
2. 自动清理超过指定天数的备份
3. 记录备份日志
"""

import os
import sys
import shutil
import sqlite3
from datetime import datetime

# 路径配置
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
BACKUP_DIR = os.path.join(BASE_DIR, 'backups')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

# 确保目录存在
os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

def log_message(message):
    """记录日志"""
    log_file = os.path.join(LOG_DIR, f'backup_{datetime.now().strftime("%Y%m%d")}.log')
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(f"[{timestamp}] {message}\n")

def create_backup():
    """创建数据库备份"""
    db_path = os.path.join(DATA_DIR, 'review.db')
    
    if not os.path.exists(db_path):
        log_message("错误：数据库文件不存在")
        return None
    
    # 生成备份文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"backup_{timestamp}.db")
    
    try:
        # 复制数据库
        shutil.copy2(db_path, backup_path)
        log_message(f"备份成功：{backup_path}")
        return backup_path
    except Exception as e:
        log_message(f"备份失败：{str(e)}")
        return None

def cleanup_old_backups(days=7):
    """清理超过指定天数的备份"""
    if not os.path.exists(BACKUP_DIR):
        return 0
    
    deleted = 0
    now = datetime.now()
    
    for filename in os.listdir(BACKUP_DIR):
        if filename.startswith('backup_') and filename.endswith('.db'):
            filepath = os.path.join(BACKUP_DIR, filename)
            try:
                # 从文件名提取日期
                date_str = filename.replace('backup_', '').replace('.db', '')
                file_date = datetime.strptime(date_str, "%Y%m%d_%H%M%S")
                
                # 计算天数差
                diff = (now - file_date).days
                if diff > days:
                    os.remove(filepath)
                    deleted += 1
                    log_message(f"删除旧备份：{filename}")
            except Exception:
                pass
    
    if deleted > 0:
        log_message(f"共删除 {deleted} 个旧备份")
    
    return deleted

def list_backups():
    """列出所有备份"""
    if not os.path.exists(BACKUP_DIR):
        return []
    
    backups = []
    for filename in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if filename.startswith('backup_') and filename.endswith('.db'):
            filepath = os.path.join(BACKUP_DIR, filename)
            backups.append({
                'filename': filename,
                'path': filepath,
                'size': os.path.getsize(filepath),
                'time': datetime.fromtimestamp(os.path.getmtime(filepath))
            })
    return backups

def restore_backup(backup_filename):
    """还原指定备份"""
    import re
    # 白名单验证
    if not re.match(r'^[\w\.-]+\.db$', backup_filename):
        log_message(f"无效的备份文件名: {backup_filename}")
        return False
    
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    # 验证路径确实在BACKUP_DIR内
    if not os.path.realpath(backup_path).startswith(os.path.realpath(BACKUP_DIR)):
        log_message(f"路径遍历尝试: {backup_filename}")
        return False
    
    db_path = os.path.join(DATA_DIR, 'review.db')
    
    if not os.path.exists(backup_path):
        log_message(f"错误：备份文件不存在 {backup_filename}")
        return False
    
    try:
        # 先备份当前数据库
        current_backup = os.path.join(BACKUP_DIR, f"before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")
        shutil.copy2(db_path, current_backup)
        log_message(f"还原前备份当前数据库：{current_backup}")
        
        # 关闭数据库连接
        conn = sqlite3.connect(db_path)
        conn.close()
        
        # 还原数据库
        shutil.copy2(backup_path, db_path)
        log_message(f"还原成功：从 {backup_filename}")
        return True
    except Exception as e:
        log_message(f"还原失败：{str(e)}")
        return False

def delete_backup(backup_filename):
    """删除指定备份"""
    import re
    # 白名单验证
    if not re.match(r'^[\w\.-]+\.db$', backup_filename):
        log_message(f"无效的备份文件名: {backup_filename}")
        return False
    
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    # 验证路径确实在BACKUP_DIR内
    if not os.path.realpath(backup_path).startswith(os.path.realpath(BACKUP_DIR)):
        log_message(f"路径遍历尝试: {backup_filename}")
        return False
    
    if not os.path.exists(backup_path):
        return False
    
    try:
        os.remove(backup_path)
        log_message(f"删除备份：{backup_filename}")
        return True
    except Exception as e:
        log_message(f"删除备份失败：{str(e)}")
        return False

if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'backup'
    
    if action == 'backup':
        create_backup()
        cleanup_old_backups(7)
    elif action == 'list':
        for b in list_backups():
            print(f"{b['filename']} - {b['size']} bytes - {b['time']}")
    elif action == 'restore' and len(sys.argv) > 2:
        restore_backup(sys.argv[2])
    elif action == 'cleanup':
        cleanup_old_backups(7)
    else:
        print("用法：")
        print("  backup.py backup    - 创建备份")
        print("  backup.py list      - 列出所有备份")
        print("  backup.py restore <文件名> - 还原备份")
        print("  backup.py cleanup   - 清理旧备份")
