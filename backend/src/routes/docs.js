const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 文档根目录 - 可通过环境变量配置，默认为 backend/docs
const DOCS_ROOT = process.env.DOCS_ROOT || path.join(__dirname, '../../docs');

// 获取文档目录列表
router.get('/list', (req, res) => {
  try {
    const { dir = '' } = req.query;
    const targetDir = path.join(DOCS_ROOT, dir);

    // 安全检查：防止路径穿越攻击
    const resolvedPath = path.resolve(targetDir);
    if (!resolvedPath.startsWith(path.resolve(DOCS_ROOT))) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    // 检查目录是否存在
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: '目录不存在' });
    }

    const items = fs.readdirSync(targetDir, { withFileTypes: true });
    const result = items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'directory' : 'file',
      path: dir ? `${dir}/${item.name}` : item.name,
      extension: item.isFile() ? path.extname(item.name).toLowerCase() : null
    }));

    // 目录在前，文件在后，都按名称排序
    result.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    res.json(result);
  } catch (error) {
    console.error('Error listing docs:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单个文档内容
router.get('/content', (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({ error: '缺少文件路径参数' });
    }

    // 安全检查：只允许 .md 文件
    if (!filePath.endsWith('.md')) {
      return res.status(400).json({ error: '只支持 .md 文件' });
    }

    const targetFile = path.join(DOCS_ROOT, filePath);

    // 安全检查：防止路径穿越攻击
    const resolvedPath = path.resolve(targetFile);
    if (!resolvedPath.startsWith(path.resolve(DOCS_ROOT))) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    // 检查文件是否存在
    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 读取文件内容
    const content = fs.readFileSync(targetFile, 'utf8');
    const stats = fs.statSync(targetFile);

    res.json({
      path: filePath,
      name: path.basename(filePath),
      content,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    });
  } catch (error) {
    console.error('Error reading doc:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取文档树结构（用于侧边栏导航）
router.get('/tree', (req, res) => {
  try {
    function buildTree(dirPath, relativePath = '') {
      if (!fs.existsSync(dirPath)) {
        return [];
      }

      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      const result = [];

      for (const item of items) {
        // 跳过隐藏文件和目录
        if (item.name.startsWith('.')) continue;

        const itemPath = relativePath ? `${relativePath}/${item.name}` : item.name;

        if (item.isDirectory()) {
          const children = buildTree(path.join(dirPath, item.name), itemPath);
          // 只包含有 .md 文件的目录
          if (children.length > 0) {
            result.push({
              name: item.name,
              path: itemPath,
              type: 'directory',
              children
            });
          }
        } else if (item.name.endsWith('.md')) {
          result.push({
            name: item.name,
            path: itemPath,
            type: 'file'
          });
        }
      }

      // 按名称排序：目录在前，文件在后
      result.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      return result;
    }

    const tree = buildTree(DOCS_ROOT);
    res.json(tree);
  } catch (error) {
    console.error('Error building doc tree:', error);
    res.status(500).json({ error: error.message });
  }
});

// 搜索文档
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: '搜索关键词至少需要2个字符' });
    }

    const searchTerm = q.toLowerCase();
    const results = [];

    function searchInDir(dirPath, relativePath = '') {
      if (!fs.existsSync(dirPath)) return;

      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (item.name.startsWith('.')) continue;

        const itemPath = relativePath ? `${relativePath}/${item.name}` : item.name;

        if (item.isDirectory()) {
          searchInDir(path.join(dirPath, item.name), itemPath);
        } else if (item.name.endsWith('.md')) {
          const fullPath = path.join(dirPath, item.name);
          const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();

          // 在文件名或内容中搜索
          const nameMatch = item.name.toLowerCase().includes(searchTerm);
          const contentIndex = content.indexOf(searchTerm);

          if (nameMatch || contentIndex !== -1) {
            // 提取匹配上下文
            let snippet = '';
            if (contentIndex !== -1) {
              const start = Math.max(0, contentIndex - 50);
              const end = Math.min(content.length, contentIndex + searchTerm.length + 50);
              snippet = (start > 0 ? '...' : '') +
                       content.substring(start, end) +
                       (end < content.length ? '...' : '');
            }

            results.push({
              name: item.name,
              path: itemPath,
              matchType: nameMatch ? 'name' : 'content',
              snippet: snippet || item.name
            });
          }
        }
      }
    }

    searchInDir(DOCS_ROOT);
    res.json(results.slice(0, 50)); // 最多返回50条结果
  } catch (error) {
    console.error('Error searching docs:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
