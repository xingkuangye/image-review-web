// ========== 全局状�?==========
let currentUser = null;
let currentImage = null;
let currentRoleId = null;
let historyStack = [];

// ========== 初始�?==========
window.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadSettings();  // 先加载配�?
        await initUser();
        await loadStats();
        await loadImage();
    } catch (e) {
        console.error('初始化失�?', e);
    }
});

// ========== 用户初始�?==========
async function initUser() {
    try {
        // 尝试从localStorage获取用户ID
        let userId = localStorage.getItem('review_user_id');
        
        let response;
        if (!userId) {
            // 创建新用�?
            response = await fetch('/api/user/init');
            if (!response.ok) throw new Error('创建用户失败');
            currentUser = await response.json();
            localStorage.setItem('review_user_id', currentUser.id);
        } else {
            // 获取现有用户
            response = await fetch(`/api/user/${userId}`);
            if (!response.ok) {
                localStorage.removeItem('review_user_id');
                await initUser();
                return;
            }
            currentUser = await response.json();
        }
        
        updateUserUI();
    } catch (e) {
        console.error('初始化用户失�?', e);
    }
}

function updateUserUI() {
    document.getElementById('userNickname').textContent = currentUser.nickname;
    document.getElementById('userReviewCount').textContent = currentUser.total_reviews;
}

// ========== 加载统计数据 ==========
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('API请求失败');
        const stats = await response.json();
        
        const progressPercent = document.getElementById('progressPercent');
        const progressFill = document.getElementById('progressFill');
        const reviewedCount = document.getElementById('reviewedCount');
        const totalCount = document.getElementById('totalCount');
        const userReviewCount = document.getElementById('userReviewCount');
        
        if (progressPercent) progressPercent.textContent = (stats.progress_percent || 0).toFixed(1);
        if (progressFill) progressFill.style.width = (stats.progress_percent || 0) + '%';
        if (reviewedCount) reviewedCount.textContent = stats.reviewed_images || 0;
        if (totalCount) totalCount.textContent = stats.total_images || 0;
        
        // 更新用户审核�?
        if (currentUser) {
            currentUser.total_reviews = stats.reviewed_images || 0;
            if (userReviewCount) userReviewCount.textContent = currentUser.total_reviews;
        }
    } catch (e) {
        console.error('加载统计数据失败:', e);
    }
}

// ========== 加载待审核图�?==========
async function loadImage() {
    const loading = document.getElementById('loadingIndicator');
    const noImage = document.getElementById('noImageHint');
    const image = document.getElementById('reviewImage');
    
    if (loading) loading.style.display = 'block';
    if (noImage) noImage.style.display = 'none';
    if (image) image.style.display = 'none';
    
    // 确保用户已初始化
    if (!currentUser || !currentUser.id) {
        if (loading) loading.textContent = '等待初始�?..';
        setTimeout(loadImage, 500);
        return;
    }
    
    try {
        const userId = currentUser.id;
        const url = currentRoleId 
            ? `/api/image/review?user_id=${userId}&role_id=${currentRoleId}`
            : `/api/image/review?user_id=${userId}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (loading) loading.style.display = 'none';
        
        if (!data.image) {
            if (noImage) noImage.style.display = 'block';
            currentImage = null;
            return;
        }
        
        currentImage = data.image;
        
        // 加载图片
        if (image) {
            image.src = '/api/image/' + currentImage.id + '/thumbnail?' + Date.now();
            image.style.display = 'block';
        }
        
        // 更新角色进度
        if (currentRoleId) {
            await loadRoleProgress();
        }
        
    } catch (e) {
        if (loading) loading.style.display = 'none';
        console.error('加载图片失败:', e);
    }
}

// ========== 加载角色进度 ==========
async function loadRoleProgress() {
    try {
        const response = await fetch('/api/roles');
        const roles = await response.json();
        const role = roles.find(r => r.id === currentRoleId);
        
        if (role) {
            const percent = role.total_images > 0 
                ? ((role.reviewed_images || 0) / role.total_images * 100).toFixed(1)
                : 0;
            
            document.getElementById('roleProgress').style.display = 'inline';
            document.getElementById('roleProgressPercent').textContent = percent;
        }
    } catch (e) {
        console.error('加载角色进度失败:', e);
    }
}

// ========== 提交审核 ==========
async function submitReview(status) {
    if (!currentImage || !currentUser) return;
    
    try {
        await fetch(`/api/image/${currentImage.id}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `user_id=${currentUser.id}&status=${status}`
        });
        
        // 保存到历�?
        historyStack.push(currentImage);
        
        // 重新加载
        await loadStats();
        await loadImage();
        
    } catch (e) {
        console.error('提交审核失败:', e);
        alert('提交失败，请重试');
    }
}

// ========== 上一�?==========
async function prevImage() {
    if (historyStack.length === 0) {
        alert('没有上一张图�?);
        return;
    }
    
    // 如果当前有图片且未审核，先审核为跳过
    if (currentImage && currentUser) {
        const userStatus = currentImage.is_reviewed_by_user;
        if (!userStatus) {
            await fetch(`/api/image/${currentImage.id}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `user_id=${currentUser.id}&status=skip`
            });
        }
    }
    
    currentImage = historyStack.pop();
    
    const image = document.getElementById('reviewImage');
    const loading = document.getElementById('loadingIndicator');
    const noImage = document.getElementById('noImageHint');
    
    if (loading) loading.style.display = 'none';
    if (noImage) noImage.style.display = 'none';
    if (image) {
        image.src = '/api/image/' + currentImage.id + '/thumbnail?' + Date.now();
        image.style.display = 'block';
    }
}

// ========== 跳过（无法定夺） ==========
async function skipImage() {
    if (!currentImage || !currentUser) return;
    
    try {
        await fetch(`/api/image/${currentImage.id}/review`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `user_id=${currentUser.id}&status=skip`
        });
        
        // 保存到历�?
        historyStack.push(currentImage);
        
        // 重新加载
        await loadStats();
        await loadImage();
        
    } catch (e) {
        console.error('跳过失败:', e);
    }
}

// ========== 下载图片 ==========
function downloadImage() {
    if (!currentImage) return;
    
    const link = document.createElement('a');
    link.href = '/api/image/' + currentImage.id + '/download';
    link.download = currentImage.path.split(/[/\\]/).pop();
    link.click();
}

// ========== 图片加载错误 ==========
function imageLoadError() {
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('noImageHint').style.display = 'block';
}

// ========== 修改昵称 ==========
function editNickname() {
    if (!currentUser) return;
    const input = document.getElementById('nicknameInput');
    const modal = document.getElementById('nicknameModal');
    if (input) input.value = currentUser.nickname || '';
    if (modal) modal.style.display = 'block';
    if (input) input.focus();
}

async function saveNickname() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (!nickname || !currentUser) return;
    
    try {
        await fetch(`/api/user/${currentUser.id}/nickname`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nickname })
        });
        
        currentUser.nickname = nickname;
        updateUserUI();
        closeNicknameModal();
    } catch (e) {
        alert('修改失败');
    }
}

function closeNicknameModal() {
    const modal = document.getElementById('nicknameModal');
    if (modal) modal.style.display = 'none';
}

// ========== 角色选择 ==========
async function showRoleModal() {
    const modal = document.getElementById('roleModal');
    const roleList = document.getElementById('roleList');
    
    try {
        const response = await fetch('/api/admin/roles');
        const roles = await response.json();
        
        if (roleList) roleList.innerHTML = '';
        
        if (!roles || roles.length === 0) {
            if (roleList) roleList.innerHTML = '<p style="color:#888;text-align:center;">暂无角色配置</p>';
        } else {
            roles.forEach(role => {
                const item = document.createElement('div');
                item.className = 'role-item';
                item.onclick = () => selectRole(role.id);
                
                const avatar = role.avatar_path 
                    ? `<img src="/uploads/${role.avatar_path.split(/[/\\]/).pop()}" class="role-avatar" onerror="this.style.display='none'">`
                    : '<div class="role-avatar"></div>';
                
                item.innerHTML = `
                    ${avatar}
                    <span class="role-name">${role.name || ''}</span>
                    <span class="role-stats">${role.reviewed_images || 0}/${role.total_images || 0}</span>
                `;
                
                if (roleList) roleList.appendChild(item);
            });
        }
        
        if (modal) modal.style.display = 'block';
    } catch (e) {
        console.error('加载角色列表失败:', e);
    }
}

async function selectRole(roleId) {
    currentRoleId = roleId;
    closeRoleModal();
    
    // 清除历史
    historyStack = [];
    
    // 重新加载图片
    await loadStats();
    await loadImage();
}

function closeRoleModal() {
    const modal = document.getElementById('roleModal');
    if (modal) modal.style.display = 'none';
}

// ========== 图片详情 ==========
function showImageDetail() {
    if (!currentImage) return;
    
    const detailReviewCount = document.getElementById('detailReviewCount');
    const detailPassCount = document.getElementById('detailPassCount');
    const detailFailCount = document.getElementById('detailFailCount');
    const detailSkipCount = document.getElementById('detailSkipCount');
    const myStatus = document.getElementById('myStatus');
    const modal = document.getElementById('imageDetailModal');
    
    if (detailReviewCount) detailReviewCount.textContent = currentImage.review_count || 0;
    if (detailPassCount) detailPassCount.textContent = currentImage.pass_count || 0;
    if (detailFailCount) detailFailCount.textContent = currentImage.fail_count || 0;
    if (detailSkipCount) detailSkipCount.textContent = currentImage.skip_count || 0;
    
    if (currentImage.is_reviewed_by_user) {
        const statusMap = { pass: '已通过', fail: '未通过', skip: '已跳�? };
        if (myStatus) {
            myStatus.textContent = '我的审核: ' + (statusMap[currentImage.is_reviewed_by_user] || '');
            myStatus.className = 'my-status ' + currentImage.is_reviewed_by_user;
        }
    } else {
        if (myStatus) {
            myStatus.textContent = '尚未审核';
            myStatus.className = 'my-status';
        }
    }
    
    if (modal) modal.style.display = 'block';
}

function closeImageDetailModal() {
    const modal = document.getElementById('imageDetailModal');
    if (modal) modal.style.display = 'none';
}

// ========== 审核要求 ==========
async function showRuleModal() {
    const modal = document.getElementById('ruleModal');
    const content = document.getElementById('ruleContent');
    
    if (content) content.innerHTML = '<p style="color:#888;">加载�?..</p>';
    
    try {
        const response = await fetch('/api/settings/review-rule');
        const data = await response.json();
        
        if (content) {
            content.innerHTML = parseMarkdown(data.content || '暂无审核要求');
        }
    } catch (e) {
        if (content) content.innerHTML = '<p style="color:#888;">暂无审核要求</p>';
    }
    
    if (modal) modal.style.display = 'block';
}

function closeRuleModal() {
    const modal = document.getElementById('ruleModal');
    if (modal) modal.style.display = 'none';
}

// 简单的Markdown解析（带XSS防护�?
function parseMarkdown(text) {
    if (!text) return '';
    
    // 第一步：HTML实体转义（防止XSS�?
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    
    // 第二步：解析Markdown语法
    return escaped
        // 标题（使用捕获组避免XSS�?
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // 粗体和斜�?
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // 代码（内容已经是转义的）
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // 引用
        .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
        // 列表
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
        // 换行
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

// ========== 页面加载时获取配�?==========
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        
        // 更新页面标题
        if (data.title) {
            const titleEl = document.getElementById('pageTitle');
            if (titleEl) titleEl.textContent = data.title;
        }
        
        // 更新页面图标
        if (data.icon) {
            const iconEl = document.getElementById('pageIcon');
            if (iconEl) iconEl.href = data.icon;
        }
    } catch (e) {
        console.error('加载配置失败:', e);
    }
}

// ========== 点击图片显示详情 ==========
const reviewImage = document.getElementById('reviewImage');
if (reviewImage) {
    reviewImage.addEventListener('click', showImageDetail);
}

// ========== 点击模态框外部关闭 ==========
window.onclick = function(event) {
    const modalIds = ['roleModal', 'nicknameModal', 'imageDetailModal', 'ruleModal'];
    
    modalIds.forEach(id => {
        const modal = document.getElementById(id);
        if (modal && event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// ========== 键盘快捷�?==========
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key) {
        case 'ArrowLeft':
            prevImage();
            break;
        case 'ArrowRight':
            skipImage();
            break;
        case '1':
        case 'a':
        case 'A':
            submitReview('fail');
            break;
        case '2':
        case 'd':
        case 'D':
            submitReview('pass');
            break;
    }
});

