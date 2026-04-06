with open('static/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: admin/roles -> roles
content = content.replace("fetch('/api/admin/roles')", "fetch('/api/roles')")

# Check for mojibake
import re
problems = re.findall(r'[\x80-\xff]+\?\?[\x80-\xff]*', content)
if problems:
    print('Found mojibake patterns:')
    for p in set(problems):
        print(f'  {repr(p)}')
else:
    print('No mojibake found')

with open('static/js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
