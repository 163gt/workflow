const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');

const router = express.Router();

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

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
    stmt.bind([req.params.id]);
    if (!stmt.step()) {
      stmt.free();
      return res.status(404).json({ error: '任务空间不存在' });
    }
    const workspace = stmt.getAsObject();
    stmt.free();
    res.json(workspace);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const workspaceId = req.params.id;

    const workflowStmt = db.prepare('SELECT id FROM workflows WHERE workspaceId = ?');
    workflowStmt.bind([workspaceId]);
    const workflowIds = [];
    while (workflowStmt.step()) {
      workflowIds.push(workflowStmt.getAsObject().id);
    }
    workflowStmt.free();

    workflowIds.forEach((workflowId) => {
      db.run('DELETE FROM batch_job_items WHERE batchJobId IN (SELECT id FROM batch_jobs WHERE workflowId = ?)', [workflowId]);
      db.run('DELETE FROM batch_jobs WHERE workflowId = ?', [workflowId]);
      db.run('DELETE FROM workflow_param_sets WHERE workflowId = ?', [workflowId]);
      db.run('DELETE FROM schedules WHERE workflowId = ?', [workflowId]);
      db.run('DELETE FROM node_executions WHERE executionId IN (SELECT id FROM execution_logs WHERE workflowId = ?)', [workflowId]);
      db.run('DELETE FROM execution_logs WHERE workflowId = ?', [workflowId]);
    });

    db.run('DELETE FROM workflows WHERE workspaceId = ?', [workspaceId]);
    db.run('DELETE FROM workspaces WHERE id = ?', [workspaceId]);

    saveDatabase();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/duplicate', (req, res) => {
  try {
    const db = getDb();
    const workspaceId = req.params.id;

    const wsStmt = db.prepare('SELECT * FROM workspaces WHERE id = ?');
    wsStmt.bind([workspaceId]);
    if (!wsStmt.step()) {
      wsStmt.free();
      return res.status(404).json({ error: '任务空间不存在' });
    }
    const originalWorkspace = wsStmt.getAsObject();
    wsStmt.free();

    const newWorkspaceId = uuidv4();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO workspaces (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
      [newWorkspaceId, `${originalWorkspace.name} (副本)`, originalWorkspace.description || '', now]
    );

    const wfStmt = db.prepare('SELECT * FROM workflows WHERE workspaceId = ?');
    wfStmt.bind([workspaceId]);
    const workflows = [];
    while (wfStmt.step()) {
      workflows.push(wfStmt.getAsObject());
    }
    wfStmt.free();

    const newWorkflows = [];
    workflows.forEach((workflow) => {
      const newWorkflowId = uuidv4();
      db.run(
        'INSERT INTO workflows (id, workspaceId, name, nodes, edges, paramsSchema, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          newWorkflowId,
          newWorkspaceId,
          `${workflow.name} (副本)`,
          workflow.nodes,
          workflow.edges,
          workflow.paramsSchema || '[]',
          now
        ]
      );

      newWorkflows.push({
        id: newWorkflowId,
        name: `${workflow.name} (副本)`
      });
    });

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
