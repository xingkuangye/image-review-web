# 图片审核系统安全审查报告

## 执行摘要

本次审查验证了项目代码中之前发现的5个安全问题的修复情况。经过详细检查，发现**4个问题已正确修复**，但**1个修复存在问题**，同时**发现3个新的安全问题**需要立即处理。

---

## 一、之前问题的修复验证

### 1. 路径遍历漏洞 - 部分修复，存在严重问题

**问题位置**: `backend/main.py` 第486-510行

**检查结果**: 代码添加了白名单验证和管理员认证，但存在**导入错误导致认证功能完全失效**。

```python
@app.post("/api/admin/backup/restore/{filename}")
async def admin_restore_backup(filename: str, x_admin_password: str = Header(None)):
    """还原指定备份"""
    import re
    from backend.services import verify_admin  # <-- 错误：从services导入但verify_admin定义在main.py
    from backend.backup import restore_backup
    
    # 验证管理员权限
    if not verify_admin(x_admin_password):  # <-- 会抛出NameError
        raise HTTPException(status_code=401, detail="认证失败")
```

**问题分析**:
- `verify_admin` 函数实际定义在 `main.py` 第130行
- `admin_restore_backup` 函数试图从 `backend.services` 导入 `verify_admin`
- 由于 services.py 中不存在该函数，会导致 `ImportError` 或 `NameError`
- **结果**: 认证检查永远不会执行，攻击者可以无需认证即可恢复任意备份文件

**修复状态**: ❌ **未正确修复** - 代码存在但无法正常工作

---

### 2. 密码存储安全 - 已正确修复

**问题位置**: `static/js/admin.js`

**检查结果**: ✅ 已正确修复

代码现在使用 `sessionStorage` 替代 `localStorage`，并添加了1小时过期机制：

```javascript
// 使用sessionStorage存储，浏览器/标签页关闭后自动清除
sessionStorage.setItem('admin_session', password);
// 设置1小时过期
sessionStorage.setItem('admin_expire', Date.now() + 3600000);
```

**修复状态**: ✅ **已正确修复**

---

### 3. Markdown XSS - 已正确修复

**问题位置**: `static/js/app.js` 第372-396行

**检查结果**: ✅ 已正确修复

代码先进行HTML实体转义再解析Markdown：

```javascript
function parseMarkdown(text) {
    if (!text) return '';
    
    // 第一步：HTML实体转义（防止XSS）
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    
    // 第二步：解析Markdown语法
    return escaped
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        ...
}
```

**修复状态**: ✅ **已正确修复**

---

### 4. 错误处理 - 已正确修复

**问题位置**: `backend/services.py` 多处

**检查结果**: ✅ 已正确修复

代码将裸的 `except:` 替换为带日志的异常处理：

```python
# 原始代码（不安全）
except:
    pass

# 修复后
except Exception as e:
    log_message(f"扫描图片时发生错误: {full_path} - {str(e)}")
```

**修复状态**: ✅ **已正确修复**

---

### 5. N+1查询 - 已正确修复

**问题位置**: `backend/services.py` 的 `get_all_roles` 函数

**检查结果**: ✅ 已正确修复

代码使用单个JOIN查询替代多次单独查询：

```python
def get_all_roles() -> List[RoleResponse]:
    """获取所有角色（优化：使用JOIN一次性查询）"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 优化：使用单个查询获取所有数据，避免N+1问题
    cursor.execute('''
        SELECT 
            r.id, r.name, r.image_path, r.avatar_path,
            COUNT(DISTINCT i.id) as total_images,
            SUM(CASE WHEN rev.status = 'pass' THEN 1 ELSE 0 END) as pass_count,
            SUM(CASE WHEN rev.status = 'fail' THEN 1 ELSE 0 END) as fail_count
        FROM roles r
        LEFT JOIN images i ON r.id = i.role_id
        LEFT JOIN reviews rev ON i.id = rev.image_id
        GROUP BY r.id
    ''')
```

**修复状态**: ✅ **已正确修复**

---

## 二、新发现的安全问题

### 严重问题 1: 大部分管理API缺少管理员认证

**风险等级**: 🔴 **严重**

**问题描述**: 系统中几乎所有管理API端点（位于 `/api/admin/` 下）都**没有任何管理员认证机制**。攻击者可以直接访问这些端点进行未授权操作。

**受影响端点**（约30个）:

| 端点 | 操作 | 风险 |
|------|------|------|
| `POST /api/admin/roles` | 创建角色 | 上传任意文件到服务器 |
| `PUT /api/admin/roles/{id}` | 修改角色 | 修改系统配置 |
| `DELETE /api/admin/roles/{id}` | 删除角色 | 删除数据 |
| `GET /api/admin/users` | 获取用户列表 | 信息泄露 |
| `DELETE /api/admin/reviews/{id}` | 删除审核记录 | 数据篡改 |
| `DELETE /api/admin/users/{id}/reviews` | 清除用户审核记录 | 数据篡改 |
| `POST /api/admin/users/{id}/ban` | 封禁/解封用户 | 账户控制 |
| `GET /api/admin/stats` | 获取统计信息 | 信息泄露 |
| `GET /api/admin/export` | 导出审核通过的图片 | 数据泄露 |
| `GET /api/admin/settings` | 获取设置 | 信息泄露 |
| `PUT /api/admin/settings/*` | 修改各种设置 | 配置篡改 |
| `POST /api/admin/backup/now` | 执行手动备份 | 资源消耗 |
| `GET /api/admin/backup/list` | 列出备份 | 信息泄露 |

**攻击场景示例**:

```bash
# 1. 创建恶意角色（上传webshell）
curl -X POST http://server/api/admin/roles \
  -H "Content-Type: multipart/form-data" \
  -F "name=evil" \
  -F "image_path=/var/www/html/shell.php"

# 2. 封禁所有用户
curl -X POST http://server/api/admin/users/any_user_id/ban \
  -d "banned=true"

# 3. 导出敏感数据
curl -O http://server/api/admin/export
```

**建议修复**: 为所有管理API添加统一的认证装饰器，例如：

```python
from functools import wraps
from fastapi import HTTPException, Header

def require_admin(func):
    @wraps(func)
    async def wrapper(*args, x_admin_password: str = Header(None), **kwargs):
        if not verify_admin(x_admin_password):
            raise HTTPException(status_code=401, detail="需要管理员认证")
        return await func(*args, **kwargs)
    return wrapper

@app.post("/api/admin/roles")
@require_admin
async def admin_create_role(...):
    ...
```

**修复状态**: ❌ **未修复**

---

### 严重问题 2: 文件上传路径遍历

**风险等级**: 🔴 **严重**

**问题位置**: `backend/main.py` 第271-287行

**问题描述**: 角色头像上传功能未验证文件名，可能导致路径遍历攻击。

```python
@app.post("/api/admin/roles")
async def admin_create_role(
    name: str = Form(...),
    image_path: str = Form(...),
    avatar: UploadFile = File(None)
):
    """创建角色"""
    avatar_path = None
    if avatar:
        filename = f"{uuid.uuid4()}_{avatar.filename}"  # <-- 直接使用用户提供的文件名
        avatar_path = os.path.join(UPLOADS_DIR, filename)
        with open(avatar_path, 'wb') as f:
            f.write(await avatar.read())
```

**攻击示例**: 上传文件名为 `../../../var/www/html/shell.php` 的文件，可能覆盖服务器上的其他文件。

**建议修复**: 对文件名进行严格验证：

```python
if avatar:
    # 提取纯文件名，移除所有路径组件
    safe_filename = os.path.basename(avatar.filename.replace('/', '\\').replace('\\', '/'))
    # 验证文件扩展名
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="不支持的文件类型")
    filename = f"{uuid.uuid4()}_{safe_filename}"
    avatar_path = os.path.join(UPLOADS_DIR, filename)
```

**修复状态**: ❌ **未修复**

---

### 中等问题 3: 敏感信息泄露 - 启动时打印密码到控制台

**风险等级**: 🟡 **中等**

**问题位置**: `backend/main.py` 第101-106行

**问题描述**: 应用程序启动时将管理员密码打印到控制台，可能被日志收集工具或屏幕截图记录。

```python
@app.on_event("startup")
async def startup():
    global admin_password, scheduler_running
    init_db()
    admin_password = get_admin_password()
    log_message(f"管理员密码: {admin_password}")  # <-- 密码写入日志文件
    print(f"\n{'='*50}")
    print(f"管理员密码: {admin_password}")  # <-- 密码打印到控制台
    print(f"{'='*50}\n")
```

**风险**: 
- 在多用户服务器环境中，其他用户可能看到密码
- 日志文件可能包含敏感信息
- CI/CD管道的输出可能暴露密码

**建议修复**:
```python
@app.on_event("startup")
async def startup():
    global admin_password, scheduler_running
    init_db()
    admin_password = get_admin_password()
    # 仅记录密码长度，不记录实际密码
    log_message(f"管理员密码已初始化，长度: {len(admin_password)}")
    print(f"\n{'='*50}")
    print(f"管理员密码: {'*' * len(admin_password)}")  # 隐藏密码
    print(f"{'='*50}\n")
```

**修复状态**: ❌ **未修复**

---

## 三、已修复问题汇总

| 问题 | 状态 | 说明 |
|------|------|------|
| 路径遍历漏洞 | ❌ 部分修复 | 白名单已添加，但认证代码无法运行 |
| 密码存储安全 | ✅ 已修复 | 改用sessionStorage，添加1小时过期 |
| Markdown XSS | ✅ 已修复 | 先HTML转义再解析 |
| 错误处理 | ✅ 已修复 | 使用带日志的异常处理 |
| N+1查询 | ✅ 已修复 | 使用JOIN优化 |

---

## 四、新发现问题汇总

| 问题 | 风险等级 | 修复优先级 |
|------|----------|------------|
| 大部分管理API缺少认证 | 🔴 严重 | **P0 - 立即修复** |
| 文件上传路径遍历 | 🔴 严重 | **P0 - 立即修复** |
| 启动时打印密码 | 🟡 中等 | P1 - 高优先级 |

---

## 五、修复建议

### 立即需要修复

1. **修复 `admin_restore_backup` 和 `admin_delete_backup` 的导入错误**:
   ```python
   # 删除这行错误的导入
   # from backend.services import verify_admin
   
   # 直接调用本地定义的 verify_admin 函数
   if not verify_admin(x_admin_password):
       raise HTTPException(status_code=401, detail="认证失败")
   ```

2. **为所有管理API添加统一认证装饰器**，确保每个 `/api/admin/` 端点都需要认证

3. **修复文件上传路径遍历问题**，对上传的文件名进行严格验证

### 建议后续改进

1. 移除启动时打印密码的代码
2. 添加请求频率限制防止暴力破解
3. 实现审计日志记录所有管理操作
4. 添加IP白名单功能

---

## 六、结论

本次审查发现，之前的5个安全问题中有4个已正确修复，但路径遍历漏洞的修复因代码错误而完全失效。更重要的是，审查发现了**3个新的高危安全问题**，其中管理API缺少认证是最严重的问题，攻击者可以完全控制整个系统。

**强烈建议立即修复所有标记为 P0 的问题后再将系统部署到生产环境。**
