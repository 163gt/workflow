const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');
const { executeWorkflowById, parseWorkflowRow, safeJsonParse } = require('../services/workflowExecution');

const router = express.Router();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWorkflowById(db, workflowId) {
  const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
  stmt.bind([workflowId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const workflow = parseWorkflowRow(stmt.getAsObject());
  stmt.free();
  return workflow;
}

function getParamSetById(db, workflowId, paramSetId) {
  const stmt = db.prepare('SELECT * FROM workflow_param_sets WHERE workflowId = ? AND id = ?');
  stmt.bind([workflowId, paramSetId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return {
    ...row,
    params: safeJsonParse(row.params, {})
  };
}

function getAllParamSets(db, workflowId) {
  const stmt = db.prepare('SELECT * FROM workflow_param_sets WHERE workflowId = ? ORDER BY createdAt DESC');
  stmt.bind([workflowId]);
  const paramSets = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    paramSets.push({
      ...row,
      params: safeJsonParse(row.params, {})
    });
  }
  stmt.free();
  return paramSets;
}

async function executeBatchForParamSets(workflowId, options = {}) {
  const db = getDb();
  const { paramSetIds = null, intervalSeconds = 0, name } = options;

  const workflow = getWorkflowById(db, workflowId);
  if (!workflow) {
    const error = new Error('工作流不存在');
    error.statusCode = 404;
    throw error;
  }

  const targetParamSets = Array.isArray(paramSetIds) && paramSetIds.length > 0
    ? paramSetIds.map((paramSetId) => getParamSetById(db, workflowId, paramSetId)).filter(Boolean)
    : getAllParamSets(db, workflowId);

  if (targetParamSets.length === 0) {
    const error = new Error('当前工作流下没有可执行的参数集');
    error.statusCode = 400;
    throw error;
  }

  const batchJobId = uuidv4();
  const createdAt = new Date().toISOString();
  db.run(
    'INSERT INTO batch_jobs (id, workflowId, name, intervalSeconds, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [batchJobId, workflowId, name || `${workflow.name} 批量执行`, intervalSeconds || 0, 'running', createdAt]
  );

  const summary = [];
  for (let index = 0; index < targetParamSets.length; index += 1) {
    const paramSet = targetParamSets[index];
    const batchItemId = uuidv4();

    db.run(
      'INSERT INTO batch_job_items (id, batchJobId, workflowId, paramSetId, sequence, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [batchItemId, batchJobId, workflowId, paramSet.id, index + 1, 'running', new Date().toISOString()]
    );
    saveDatabase();

    const executionResult = await executeWorkflowById(workflowId, {
      params: paramSet.params || {},
      paramSetId: paramSet.id,
      batchJobId,
      batchItemId
    });

    db.run(
      'UPDATE batch_job_items SET status = ?, executionId = ?, startedAt = ?, finishedAt = ?, error = ? WHERE id = ?',
      [
        executionResult.status,
        executionResult.id,
        executionResult.startedAt,
        executionResult.finishedAt,
        executionResult.error || null,
        batchItemId
      ]
    );
    saveDatabase();

    summary.push({
      batchItemId,
      paramSetId: paramSet.id,
      paramSetName: paramSet.name,
      executionId: executionResult.id,
      status: executionResult.status,
      error: executionResult.error || null
    });

    if (intervalSeconds > 0 && index < targetParamSets.length - 1) {
      await sleep(intervalSeconds * 1000);
    }
  }

  const finalStatus = summary.some((item) => item.status === 'failed') ? 'partial_failed' : 'success';
  db.run(
    'UPDATE batch_jobs SET status = ?, finishedAt = ? WHERE id = ?',
    [finalStatus, new Date().toISOString(), batchJobId]
  );
  saveDatabase();

  return {
    id: batchJobId,
    workflowId,
    intervalSeconds,
    status: finalStatus,
    items: summary
  };
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const workspaceId = req.query.workspaceId;

    let sql = 'SELECT * FROM workflows';
    let params = [];
    if (workspaceId) {
      sql += ' WHERE workspaceId = ?';
      params = [workspaceId];
    }
    sql += ' ORDER BY createdAt DESC';

    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);

    const workflows = [];
    while (stmt.step()) {
      workflows.push(parseWorkflowRow(stmt.getAsObject()));
    }
    stmt.free();
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const workflow = getWorkflowById(getDb(), req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: '工作流不存在' });
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { workspaceId, name, nodes, edges, paramsSchema } = req.body;
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const nodesStr = typeof nodes === 'string' ? nodes : JSON.stringify(nodes || []);
    const edgesStr = typeof edges === 'string' ? edges : JSON.stringify(edges || []);
    const paramsSchemaStr = typeof paramsSchema === 'string' ? paramsSchema : JSON.stringify(paramsSchema || []);

    db.run(
      'INSERT INTO workflows (id, workspaceId, name, nodes, edges, paramsSchema, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, workspaceId, name || '新工作流', nodesStr, edgesStr, paramsSchemaStr, createdAt]
    );

    saveDatabase();
    res.status(201).json(getWorkflowById(db, id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, nodes, edges, paramsSchema } = req.body;
    const updatedAt = new Date().toISOString();
    const nodesStr = typeof nodes === 'string' ? nodes : JSON.stringify(nodes || []);
    const edgesStr = typeof edges === 'string' ? edges : JSON.stringify(edges || []);
    const paramsSchemaStr = typeof paramsSchema === 'string' ? paramsSchema : JSON.stringify(paramsSchema || []);

    db.run(
      'UPDATE workflows SET name = ?, nodes = ?, edges = ?, paramsSchema = ?, updatedAt = ? WHERE id = ?',
      [name, nodesStr, edgesStr, paramsSchemaStr, updatedAt, req.params.id]
    );

    saveDatabase();
    const workflow = getWorkflowById(db, req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: '工作流不存在' });
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const workflowId = req.params.id;

    db.run('DELETE FROM batch_job_items WHERE batchJobId IN (SELECT id FROM batch_jobs WHERE workflowId = ?)', [workflowId]);
    db.run('DELETE FROM batch_jobs WHERE workflowId = ?', [workflowId]);
    db.run('DELETE FROM workflow_param_sets WHERE workflowId = ?', [workflowId]);
    db.run('DELETE FROM node_executions WHERE executionId IN (SELECT id FROM execution_logs WHERE workflowId = ?)', [workflowId]);
    db.run('DELETE FROM schedules WHERE workflowId = ?', [workflowId]);
    db.run('DELETE FROM execution_logs WHERE workflowId = ?', [workflowId]);
    db.run('DELETE FROM workflows WHERE id = ?', [workflowId]);

    saveDatabase();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/param-sets', (req, res) => {
  try {
    res.json(getAllParamSets(getDb(), req.params.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/param-sets', (req, res) => {
  try {
    const db = getDb();
    const { name, params } = req.body;
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.run(
      'INSERT INTO workflow_param_sets (id, workflowId, name, params, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, name || '未命名参数集', JSON.stringify(params || {}), createdAt]
    );

    saveDatabase();
    res.status(201).json(getParamSetById(db, req.params.id, id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/param-sets/:paramSetId', (req, res) => {
  try {
    const db = getDb();
    const { name, params } = req.body;
    const updatedAt = new Date().toISOString();

    db.run(
      'UPDATE workflow_param_sets SET name = ?, params = ?, updatedAt = ? WHERE workflowId = ? AND id = ?',
      [name || '未命名参数集', JSON.stringify(params || {}), updatedAt, req.params.id, req.params.paramSetId]
    );

    saveDatabase();
    const paramSet = getParamSetById(db, req.params.id, req.params.paramSetId);
    if (!paramSet) {
      return res.status(404).json({ error: '参数集不存在' });
    }
    res.json(paramSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id/param-sets/:paramSetId', (req, res) => {
  try {
    const db = getDb();
    db.run('DELETE FROM workflow_param_sets WHERE workflowId = ? AND id = ?', [req.params.id, req.params.paramSetId]);
    saveDatabase();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/execute', async (req, res) => {
  try {
    const { params = {}, paramSetId = null, batchJobId = null, batchItemId = null } = req.body || {};
    const result = await executeWorkflowById(req.params.id, { params, paramSetId, batchJobId, batchItemId });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/:id/param-sets/:paramSetId/execute', async (req, res) => {
  try {
    const db = getDb();
    const paramSet = getParamSetById(db, req.params.id, req.params.paramSetId);
    if (!paramSet) {
      return res.status(404).json({ error: '参数集不存在' });
    }

    const result = await executeWorkflowById(req.params.id, {
      params: paramSet.params || {},
      paramSetId: paramSet.id
    });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/:id/batch-execute', async (req, res) => {
  try {
    const { paramSetIds = null, intervalSeconds = 0, name } = req.body || {};
    const result = await executeBatchForParamSets(req.params.id, { paramSetIds, intervalSeconds, name });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/:id/execute-all-param-sets', async (req, res) => {
  try {
    const { intervalSeconds = 0, name } = req.body || {};
    const result = await executeBatchForParamSets(req.params.id, { intervalSeconds, name });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/:workflowId/batches', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM batch_jobs WHERE workflowId = ? ORDER BY createdAt DESC');
    stmt.bind([req.params.workflowId]);

    const jobs = [];
    while (stmt.step()) {
      jobs.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:workflowId/batches/:batchJobId', (req, res) => {
  try {
    const db = getDb();
    const jobStmt = db.prepare('SELECT * FROM batch_jobs WHERE workflowId = ? AND id = ?');
    jobStmt.bind([req.params.workflowId, req.params.batchJobId]);

    if (!jobStmt.step()) {
      jobStmt.free();
      return res.status(404).json({ error: '批量任务不存在' });
    }

    const job = jobStmt.getAsObject();
    jobStmt.free();

    const itemStmt = db.prepare(`
      SELECT bji.*, wps.name as paramSetName
      FROM batch_job_items bji
      LEFT JOIN workflow_param_sets wps ON bji.paramSetId = wps.id
      WHERE bji.batchJobId = ?
      ORDER BY bji.sequence ASC
    `);
    itemStmt.bind([req.params.batchJobId]);

    const items = [];
    while (itemStmt.step()) {
      items.push(itemStmt.getAsObject());
    }
    itemStmt.free();

    res.json({ ...job, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:workflowId/prune', (req, res) => {
  try {
    const db = getDb();
    const { workflowId } = req.params;

    const allLogs = [];
    const stmt = db.prepare('SELECT id FROM execution_logs WHERE workflowId = ? ORDER BY startedAt DESC');
    stmt.bind([workflowId]);
    while (stmt.step()) {
      allLogs.push(stmt.getAsObject());
    }
    stmt.free();

    if (allLogs.length <= 1) {
      return res.status(200).json({ message: '没有需要清理的记录' });
    }

    const toKeep = allLogs[0].id;
    const toDelete = allLogs.slice(1).map((item) => item.id);
    const placeholders = toDelete.map(() => '?').join(',');

    db.run(`DELETE FROM node_executions WHERE executionId IN (${placeholders})`, toDelete);
    db.run(`DELETE FROM execution_logs WHERE id IN (${placeholders})`, toDelete);
    saveDatabase();

    res.status(200).json({ message: `已删除 ${toDelete.length} 条记录，保留最新一条 ${toKeep}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
