const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');

// 获取所有任务空间
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM workspaces ORDER BY createdAt DESC');
    const workspaces = [];
    while (stmt.step()) {
      workspaces.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个任务空间
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
    stmt.bind([req.params.id]);
    if (stmt.step()) {
      const workspace = stmt.getAsObject();
      stmt.free();
      res.json(workspace);
    } else {
      stmt.free();
      res.status(404).json({ error: '任务空间不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建任务空间
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, description } = req.body;
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    
    db.run(
      'INSERT INTO workspaces (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
      [id, name || '新任务空间', description || '', createdAt]
    );
    
    saveDatabase();
    res.status(201).json({ id, name, description, createdAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新任务空间
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, description } = req.body;
    const updatedAt = new Date().toISOString();
    
    db.run(
      'UPDATE workspaces SET name = ?, description = ?, updatedAt = ? WHERE id = ?',
      [name, description, updatedAt, req.params.id]
    );
    
    saveDatabase();
    const stmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
    stmt.bind([req.params.id]);
    stmt.step();
    const workspace = stmt.getAsObject();
    stmt.free();
    res.json(workspace);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除任务空间（同时删除关联的工作流、定时任务和节点执行记录）
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const workspaceId = req.params.id;

    // 先删除关联的定时任务
    const workflowStmt = db.prepare('SELECT id FROM workflows WHERE workspaceId = ?');
    workflowStmt.bind([workspaceId]);
    const workflowIds = [];
    while (workflowStmt.step()) {
      workflowIds.push(workflowStmt.getAsObject().id);
    }
    workflowStmt.free();

    for (const wfId of workflowIds) {
      db.run('DELETE FROM schedules WHERE workflowId = ?', [wfId]);
      // 删除该工作流的节点执行记录
      db.run('DELETE FROM node_executions WHERE executionId IN (SELECT id FROM execution_logs WHERE workflowId = ?)', [wfId]);
      // 删除执行日志
      db.run('DELETE FROM execution_logs WHERE workflowId = ?', [wfId]);
    }

    // 删除工作流
    db.run('DELETE FROM workflows WHERE workspaceId = ?', [workspaceId]);

    // 删除任务空间
    db.run('DELETE FROM workspaces WHERE id = ?', [workspaceId]);

    saveDatabase();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 复制任务空间（包含工作流，不包含执行记录等）
router.post('/:id/duplicate', (req, res) => {
  try {
    const db = getDb();
    const workspaceId = req.params.id;

    // 获取原任务空间
    const wsStmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
    wsStmt.bind([workspaceId]);
    if (!wsStmt.step()) {
      wsStmt.free();
      return res.status(404).json({ error: '任务空间不存在' });
    }
    const originalWorkspace = wsStmt.getAsObject();
    wsStmt.free();

    // 创建新的任务空间
    const newWorkspaceId = uuidv4();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO workspaces (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
      [newWorkspaceId, `${originalWorkspace.name} (副本)`, originalWorkspace.description || '', now]
    );

    // 获取原任务空间的所有工作流
    const wfStmt = db.prepare('SELECT * FROM workflows WHERE workspaceId = ?');
    wfStmt.bind([workspaceId]);
    const workflows = [];
    while (wfStmt.step()) {
      workflows.push(wfStmt.getAsObject());
    }
    wfStmt.free();

    // 复制每个工作流
    const newWorkflows = [];
    for (const wf of workflows) {
      const newWorkflowId = uuidv4();
      db.run(
        'INSERT INTO workflows (id, workspaceId, name, nodes, edges, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [newWorkflowId, newWorkspaceId, `${wf.name} (副本)`, wf.nodes, wf.edges, now]
      );
      newWorkflows.push({
        id: newWorkflowId,
        name: `${wf.name} (副本)`
      });
    }

    saveDatabase();

    res.status(201).json({
      id: newWorkspaceId,
      name: `${originalWorkspace.name} (副本)`,
      description: originalWorkspace.description,
      createdAt: now,
      workflows: newWorkflows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;