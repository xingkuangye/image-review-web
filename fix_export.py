with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace old 5-person voting logic with new 3-person logic using get_image_final_status
old_logic = '''                for img in images:
                    img_path = img['path']
                    img_id = img['id']
                    
                    # 检查审核结果：>=3人通过视为通过
                    cursor.execute(\'\'\'
                        SELECT status, COUNT(*) as count FROM reviews
                        WHERE image_id = ? AND status != 'skip'
                        GROUP BY status
                    \'\'\', (img_id,))
                    
                    stats = {row['status']: row['count'] for row in cursor.fetchall()}
                    pass_count = stats.get('pass', 0)
                    total_votes = sum(stats.values())
                    
                    # 至少5人投票，且通过>=3
                    if total_votes >= 5 and pass_count >= 3:
                        if os.path.exists(img_path):
                            # 添加到zip，保持原文件夹结构
                            arcname = os.path.join(safe_folder_name, os.path.basename(img_path))
                            zipf.write(img_path, arcname)
                            role_pass_count += 1
                            total_count += 1'''

new_logic = '''                for img in images:
                    img_path = img['path']
                    img_id = img['id']
                    
                    # 使用服务函数判断最终状态（3人投票全部通过=pass）
                    final_status = get_image_final_status(img_id)
                    
                    # 只有全部通过的图片才导出
                    if final_status == 'pass':
                        if os.path.exists(img_path):
                            # 添加到zip，保持原文件夹结构
                            arcname = os.path.join(safe_folder_name, os.path.basename(img_path))
                            zipf.write(img_path, arcname)
                            role_pass_count += 1
                            total_count += 1'''

content = content.replace(old_logic, new_logic)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated export logic to use 3-person voting')
