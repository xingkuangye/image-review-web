with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = "# 只有全部通过的图片才导出\n                    if final_status == 'pass':"
new = "# 只有全部通过的图片才导出（None表示投票未完成，不导出）\n                    if final_status == 'pass':"

content = content.replace(old, new)

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
