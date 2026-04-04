with open('backend/services.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 添加 id ASC
content = content.replace('ORDER BY reviewed_at ASC', 'ORDER BY reviewed_at ASC, id ASC')

# 2. 添加注释
old_doc = '    - 3人投票有分歧（有通过也有不通过）= disputed'
new_doc = '    - 3人投票有分歧（有通过也有不通过）= disputed\n    注意：只取前 REQUIRED_VOTES 条投票记录'

content = content.replace(old_doc, new_doc)

with open('backend/services.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
