const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// 获取执行日志（分页）
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const workflowId = req.query.workflowId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    
    let whereClause = '';
    let params = [];
    
    if (workflowId) {
      whereClause = ' WHERE el.workflowId = ?';
      params = [workflowId];
    }
    
    // 查询总数
    let countSql = `SELECT COUNT(*) as total FROM execution_logs el${whereClause}`;
    const countStmt = db.prepare(countSql);
    if (params.length) countStmt.bind(params);
    countStmt.step();
    const total = countStmt.getAsObject().total;
    countStmt.free();
    
    // 查询分页数据
    let sql = `
      SELECT el.*, w.name as workflowName 
      FROM execution_logs el
      LEFT JOIN workflows w ON el.workflowId = w.id
      ${whereClause}
      ORDER BY el.startedAt DESC 
      LIMIT ? OFFSET ?
    `;
    
    const stmt = db.prepare(sql);
    stmt.bind([...params, pageSize, offset]);
    
    const logs = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      logs.push({
        ...row
      });
    }
    stmt.free();
    
    res.json({
      list: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个执行日志详情（包含所有节点执行记录）
router.get('/:id', (req, res) => {
  try {
    const db = getDb();

    // 获取执行日志
    const stmt = db.prepare(`
      SELECT el.*, w.name as workflowName 
      FROM execution_logs el
      LEFT JOIN workflows w ON el.workflowId = w.id
      WHERE el.id = ?
    `);
    stmt.bind([req.params.id]);

    if (stmt.step()) {
      const log = stmt.getAsObject();
      stmt.free();

      // 获取该执行的所有节点记录
      const nodeStmt = db.prepare(`
        SELECT * FROM node_executions 
        WHERE executionId = ?
        ORDER BY startedAt ASC
      `);
      nodeStmt.bind([req.params.id]);

      const nodeExecutions = [];
      while (nodeStmt.step()) {
        const node = nodeStmt.getAsObject();
        nodeExecutions.push({
          ...node,
          input: node.input ? JSON.parse(node.input) : null,
          output: node.output ? JSON.parse(node.output) : null,
          requestInfo: node.requestInfo || null
        });
      }
      nodeStmt.free();

      res.json({
        ...log,
        nodeExecutions
      });
    } else {
      stmt.free();
      res.status(404).json({ error: '执行日志不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除单条执行记录（同时删除关联的节点执行记录）
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const executionId = req.params.id;

    // 检查执行记录是否存在
    const checkStmt = db.prepare('SELECT id FROM execution_logs WHERE id = ?');
    checkStmt.bind([executionId]);
    if (!checkStmt.step()) {
      checkStmt.free();
      return res.status(404).json({ error: '执行记录不存在' });
    }
    checkStmt.free();

    // 先删除关联的节点执行记录
    db.run('DELETE FROM node_executions WHERE executionId = ?', [executionId]);

    // 删除执行日志
    db.run('DELETE FROM execution_logs WHERE id = ?', [executionId]);

    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
