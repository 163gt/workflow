const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');
const { triggerSchedule } = require('../scheduler');

// 简单的 cron 解析器
function parseCron(expression) {
  const parts = expression.split(' ');
  if (parts.length !== 5) return null;

  const [minute, hour, day, month, week] = parts;

  return {
    minute: minute === '*' ? null : (minute.startsWith('*/') ? -parseInt(minute.slice(2)) : parseInt(minute)),
    hour: hour === '*' ? null : (hour.startsWith('*/') ? -parseInt(hour.slice(2)) : parseInt(hour)),
    day: day === '*' ? null : parseInt(day),
    month: month === '*' ? null : parseInt(month),
    week: week === '*' ? null : parseInt(week),
    isMinuteInterval: minute.startsWith('*/'),
    minuteInterval: minute.startsWith('*/') ? parseInt(minute.slice(2)) : null,
    isHourInterval: hour.startsWith('*/'),
    hourInterval: hour.startsWith('*/') ? parseInt(hour.slice(2)) : null
  };
}

function getNextRunTime(cron) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);

  // 处理每 N 分钟的情况 */5 * * * *
  if (cron.isMinuteInterval) {
    const interval = cron.minuteInterval;
    // 计算下一个整点后 interval 分钟
    next.setMinutes(next.getMinutes() + 1); // 到下一分钟
    const currentMinute = next.getMinutes();
    const nextMinute = Math.ceil(currentMinute / interval) * interval;
    if (nextMinute >= 60) {
      next.setMinutes(nextMinute - 60);
      next.setHours(next.getHours() + 1);
    } else {
      next.setMinutes(nextMinute);
    }
  }
  // 处理每 N 小时的情况 0 */6 * * *
  else if (cron.isHourInterval) {
    const interval = cron.hourInterval;
    next.setHours(next.getHours() + 1);
    const currentHour = next.getHours();
    const nextHour = Math.ceil(currentHour / interval) * interval;
    if (nextHour >= 24) {
      next.setHours(nextHour % 24);
      next.setDate(next.getDate() + 1);
    } else {
      next.setHours(nextHour);
    }
  }
  // 处理每天指定时间
  else if (cron.minute !== null && cron.hour !== null && cron.day !== null && cron.month === null) {
    next.setDate(next.getDate() + 1);
    next.setHours(cron.hour);
    next.setMinutes(cron.minute);
  }
  // 处理每周
  else if (cron.week !== null) {
    const currentDay = next.getDay();
    const daysUntilTarget = (cron.week - currentDay + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntilTarget);
    next.setHours(cron.hour || 0);
    next.setMinutes(cron.minute || 0);
  }
  // 处理每月
  else if (cron.day !== null) {
    next.setMonth(next.getMonth() + 1);
    next.setDate(cron.day);
    next.setHours(cron.hour || 0);
    next.setMinutes(cron.minute || 0);
  }
  // 默认每分钟
  else {
    next.setMinutes(next.getMinutes() + 1);
  }

  return next.toISOString();
}

// 获取所有定时任务
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const workflowId = req.query.workflowId;
    const workspaceId = req.query.workspaceId;

    // 如果指定了 workspaceId，先获取该工作空间下的所有工作流，再获取它们的定时任务
    if (workspaceId && !workflowId) {
      const workflowStmt = db.prepare('SELECT id FROM workflows WHERE workspaceId = ?');
      workflowStmt.bind([workspaceId]);
      const workflowIds = [];
      while (workflowStmt.step()) {
        workflowIds.push(workflowStmt.getAsObject().id);
      }
      workflowStmt.free();

      if (workflowIds.length === 0) {
        return res.json([]);
      }

      const placeholders = workflowIds.map(() => '?').join(',');
      const stmt = db.prepare(`SELECT * FROM schedules WHERE workflowId IN (${placeholders}) ORDER BY createdAt DESC`);
      stmt.bind(workflowIds);

      const schedules = [];
      while (stmt.step()) {
        schedules.push(stmt.getAsObject());
      }
      stmt.free();
      return res.json(schedules);
    }

    let sql = 'SELECT * FROM schedules';
    let params = [];
    if (workflowId) {
      sql += ' WHERE workflowId = ?';
      params = [workflowId];
    }
    sql += ' ORDER BY createdAt DESC';

    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);

    const schedules = [];
    while (stmt.step()) {
      schedules.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个定时任务
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM schedules WHERE id = ?');
    stmt.bind([req.params.id]);
    
    if (stmt.step()) {
      const schedule = stmt.getAsObject();
      stmt.free();
      res.json(schedule);
    } else {
      stmt.free();
      res.status(404).json({ error: '定时任务不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建定时任务
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { workflowId, name, cronExpression } = req.body;
    
    if (!cronExpression) {
      return res.status(400).json({ error: 'Cron表达式不能为空' });
    }
    
    const parsed = parseCron(cronExpression);
    if (!parsed) {
      return res.status(400).json({ error: '无效的Cron表达式' });
    }
    
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const nextRunAt = getNextRunTime(parsed);
    
    db.run(
      'INSERT INTO schedules (id, workflowId, name, cronExpression, enabled, nextRunAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, workflowId, name || '定时任务', cronExpression, 1, nextRunAt, createdAt]
    );
    
    saveDatabase();
    
    res.status(201).json({
      id,
      workflowId,
      name,
      cronExpression,
      enabled: 1,
      nextRunAt,
      createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新定时任务
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, cronExpression, enabled } = req.body;
    const updatedAt = new Date().toISOString();
    
    let nextRunAt = null;
    if (cronExpression) {
      const parsed = parseCron(cronExpression);
      if (parsed) {
        nextRunAt = getNextRunTime(parsed);
      }
    }
    
    if (nextRunAt) {
      db.run(
        'UPDATE schedules SET name = ?, cronExpression = ?, enabled = ?, nextRunAt = ?, updatedAt = ? WHERE id = ?',
        [name, cronExpression, enabled !== undefined ? enabled : 1, nextRunAt, updatedAt, req.params.id]
      );
    } else {
      db.run(
        'UPDATE schedules SET name = ?, enabled = ?, updatedAt = ? WHERE id = ?',
        [name, enabled !== undefined ? enabled : 1, updatedAt, req.params.id]
      );
    }
    
    saveDatabase();
    
    const stmt = db.prepare('SELECT * FROM schedules WHERE id = ?');
    stmt.bind([req.params.id]);
    stmt.step();
    const schedule = stmt.getAsObject();
    stmt.free();
    
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除定时任务
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.run('DELETE FROM schedules WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 触发定时任务（手动执行）
router.post('/:id/trigger', async (req, res) => {
  try {
    const result = await triggerSchedule(req.params.id)
    const db = getDb()
    const stmt = db.prepare('SELECT * FROM schedules WHERE id = ?')
    stmt.bind([req.params.id])
    stmt.step()
    const schedule = stmt.getAsObject()
    stmt.free()
    
    // 更新最后执行时间
    const now = new Date().toISOString()
    const { parseCron, getNextRunTime } = require('../scheduler')
    const cron = parseCron(schedule.cronExpression)
    const nextRunAt = cron ? getNextRunTime(cron) : null
    
    db.run(
      'UPDATE schedules SET lastRunAt = ?, nextRunAt = ? WHERE id = ?',
      [now, nextRunAt, req.params.id]
    )
    saveDatabase()
    
    res.json({ schedule, executionResult: result })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router;