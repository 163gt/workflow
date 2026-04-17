const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');

// 获取所有模板
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const type = req.query.type;

    let sql = 'SELECT * FROM node_templates';
    let params = [];
    if (type) {
      sql += ' WHERE type = ?';
      params = [type];
    }
    sql += ' ORDER BY createdAt DESC';

    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);

    const templates = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      templates.push({
        ...row,
        data: JSON.parse(row.data)
      });
    }
    stmt.free();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个模板
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM node_templates WHERE id = ?');
    stmt.bind([req.params.id]);

    if (stmt.step()) {
      const template = stmt.getAsObject();
      stmt.free();
      res.json({
        ...template,
        data: JSON.parse(template.data)
      });
    } else {
      stmt.free();
      res.status(404).json({ error: '模板不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建模板
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, type, data } = req.body;

    if (!name || !type || !data) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.run(
      'INSERT INTO node_templates (id, name, type, data, createdAt) VALUES (?, ?, ?, ?, ?)',
      [id, name, type, JSON.stringify(data), createdAt]
    );

    saveDatabase();

    const stmt = db.prepare('SELECT * FROM node_templates WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const template = stmt.getAsObject();
    stmt.free();

    res.status(201).json({
      ...template,
      data: JSON.parse(template.data)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新模板
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, type, data } = req.body;
    const updatedAt = new Date().toISOString();

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (data !== undefined) {
      updates.push('data = ?');
      params.push(JSON.stringify(data));
    }

    updates.push('updatedAt = ?');
    params.push(updatedAt);
    params.push(req.params.id);

    db.run(
      `UPDATE node_templates SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    saveDatabase();

    const stmt = db.prepare('SELECT * FROM node_templates WHERE id = ?');
    stmt.bind([req.params.id]);

    if (stmt.step()) {
      const template = stmt.getAsObject();
      stmt.free();
      res.json({
        ...template,
        data: JSON.parse(template.data)
      });
    } else {
      stmt.free();
      res.status(404).json({ error: '模板不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除模板
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run('DELETE FROM node_templates WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
