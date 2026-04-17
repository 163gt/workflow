import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

export function useNodeTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 从后端加载模板
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/templates`);
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }
      const data = await response.json();
      setTemplates(data);
      setError(null);
    } catch (e) {
      console.error('加载模板失败:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 保存节点为模板
  const saveAsTemplate = useCallback(async (node, name) => {
    const template = {
      name: name || node.data?.label || 'Unnamed Template',
      type: node.type,
      data: { ...node.data }
    };

    try {
      const response = await fetch(`${API_BASE}/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(template)
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      const savedTemplate = await response.json();
      setTemplates(prev => [savedTemplate, ...prev]);
      return savedTemplate;
    } catch (e) {
      console.error('保存模板失败:', e);
      throw e;
    }
  }, []);

  // 删除模板
  const deleteTemplate = useCallback(async (templateId) => {
    try {
      const response = await fetch(`${API_BASE}/templates/${templateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (e) {
      console.error('删除模板失败:', e);
      throw e;
    }
  }, []);

  // 更新模板
  const updateTemplate = useCallback(async (templateId, updates) => {
    try {
      const response = await fetch(`${API_BASE}/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      const updatedTemplate = await response.json();
      setTemplates(prev => prev.map(t =>
        t.id === templateId ? updatedTemplate : t
      ));
      return updatedTemplate;
    } catch (e) {
      console.error('更新模板失败:', e);
      throw e;
    }
  }, []);

  // 按类型获取模板
  const getTemplatesByType = useCallback((type) => {
    return templates.filter(t => t.type === type);
  }, [templates]);

  // 创建从模板实例化的节点
  const createNodeFromTemplate = useCallback((template) => {
    return {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: template.type,
      position: { x: Math.random() * 300 + 200, y: Math.random() * 200 + 100 },
      data: { ...template.data }
    };
  }, []);

  return {
    templates,
    loading,
    error,
    saveAsTemplate,
    deleteTemplate,
    updateTemplate,
    getTemplatesByType,
    createNodeFromTemplate,
    refreshTemplates: loadTemplates
  };
}