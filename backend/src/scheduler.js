const { getDb, saveDatabase } = require('./db');

function parseCron(expression) {
  const parts = expression.split(' ');
  if (parts.length !== 5) return null;

  const [minute, hour, day, month, week] = parts;
  return {
    minute: minute === '*' ? null : minute.startsWith('*/') ? { interval: parseInt(minute.slice(2), 10) } : parseInt(minute, 10),
    hour: hour === '*' ? null : hour.startsWith('*/') ? { interval: parseInt(hour.slice(2), 10) } : parseInt(hour, 10),
    day: day === '*' ? null : parseInt(day, 10),
    month: month === '*' ? null : parseInt(month, 10),
    week: week === '*' ? null : parseInt(week, 10)
  };
}

function shouldRunAtTime(cron, now) {
  const { minute, hour, day, month, week } = cron;

  if (minute !== null) {
    if (typeof minute === 'object' && minute.interval) {
      if (now.getMinutes() % minute.interval !== 0) return false;
    } else if (now.getMinutes() !== minute) {
      return false;
    }
  }

  if (hour !== null) {
    if (typeof hour === 'object' && hour.interval) {
      if (now.getHours() % hour.interval !== 0) return false;
    } else if (now.getHours() !== hour) {
      return false;
    }
  }

  if (day !== null && now.getDate() !== day) return false;
  if (month !== null && now.getMonth() + 1 !== month) return false;
  if (week !== null && now.getDay() !== week) return false;

  return true;
}

function getNextRunTime(cron) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);

  const { minute, hour, day, week } = cron;

  if (typeof minute === 'object' && minute.interval) {
    next.setMinutes(next.getMinutes() + minute.interval);
    return next.toISOString();
  }

  if (hour !== null && day === null && week === null) {
    next.setMinutes(minute !== null ? minute : 0);
    next.setHours(hour);
    next.setSeconds(0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  if (typeof hour === 'object' && hour.interval) {
    next.setMinutes(0);
    next.setHours(next.getHours() + hour.interval);
    return next.toISOString();
  }

  if (week !== null) {
    const currentDay = now.getDay();
    const daysUntilTarget = (week - currentDay + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntilTarget);
    next.setHours(hour !== null ? hour : 0);
    next.setMinutes(minute !== null ? minute : 0);
    return next.toISOString();
  }

  if (day !== null) {
    next.setMonth(next.getMonth() + 1);
    next.setDate(day);
    next.setHours(hour !== null ? hour : 0);
    next.setMinutes(minute !== null ? minute : 0);
    return next.toISOString();
  }

  next.setMinutes(next.getMinutes() + 1);
  return next.toISOString();
}

function getApiUrl() {
  return process.env.API_URL || 'http://localhost:3001';
}

async function executeSchedule(schedule) {
  console.log(`[Scheduler] 执行任务: ${schedule.name} (${schedule.id})`);

  const db = getDb();
  const apiUrl = getApiUrl();
  const triggeredAt = new Date().toISOString();
  const cron = parseCron(schedule.cronExpression);
  const nextRunAt = cron ? getNextRunTime(cron) : null;

  // 先标记本次调度已触发，避免长任务跨分钟后被补偿逻辑重复触发。
  db.run(
    'UPDATE schedules SET lastRunAt = ?, nextRunAt = ? WHERE id = ?',
    [triggeredAt, nextRunAt, schedule.id]
  );
  saveDatabase();

  try {
    const response = await fetch(`${apiUrl}/api/workflows/${schedule.workflowId}/execute-all-param-sets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(480000)
    });

    const result = await response.json();
    const status = result.status || (response.ok ? 'success' : 'failed');

    console.log(`[Scheduler] 任务执行完成: ${schedule.name}, 状态: ${status}`);
    return {
      status,
      items: result.items || [],
      error: result.error,
      batchJobId: result.id
    };
  } catch (error) {
    console.error(`[Scheduler] 任务执行失败: ${schedule.name}, 错误: ${error.message}`);

    return { status: 'failed', error: error.message };
  }
}

let lastCheckedAt = null;
const intervalMs = 60 * 1000;

function checkAndExecuteSchedules() {
  console.log('[Scheduler] 检查定时任务');

  const db = getDb();
  const now = new Date();
  const stmt = db.prepare('SELECT * FROM schedules WHERE enabled = 1');
  const schedules = [];
  while (stmt.step()) {
    schedules.push(stmt.getAsObject());
  }
  console.log('待执行数', schedules.length);
  stmt.free();

  for (const schedule of schedules) {
    const cron = parseCron(schedule.cronExpression);
    if (!cron) continue;

    const shouldNotRepeat = schedule.lastRunAt && new Date(schedule.lastRunAt).getTime() >= now.getTime() - 60000;
    if (shouldRunAtTime(cron, now) && !shouldNotRepeat) {
      setImmediate(() => executeSchedule(schedule).catch((err) => {
        console.error(`[Scheduler] 异步任务执行异常: ${err.message}`);
      }));
      continue;
    }

    if (lastCheckedAt) {
      const checkStart = new Date(Math.max(lastCheckedAt.getTime(), now.getTime() - intervalMs));
      for (let t = new Date(checkStart); t < now; t.setMinutes(t.getMinutes() + 1)) {
        if (schedule.lastRunAt && new Date(t) <= new Date(schedule.lastRunAt)) {
          continue;
        }
        if (shouldRunAtTime(cron, t)) {
          setImmediate(() => executeSchedule(schedule).catch((err) => {
            console.error(`[Scheduler] 补执行任务异常: ${err.message}`);
          }));
          break;
        }
      }
    }
  }

  lastCheckedAt = now;
}

function startScheduler() {
  console.log('[Scheduler] 初始化定时任务调度器...');
  setTimeout(() => {
    checkAndExecuteSchedules();
  }, 10000);
  setInterval(checkAndExecuteSchedules, intervalMs);
  console.log(`[Scheduler] 调度器已启动，每 ${intervalMs / 1000} 秒检查一次定时任务`);
}

async function triggerSchedule(scheduleId) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM schedules WHERE id = ?');
  stmt.bind([scheduleId]);

  if (!stmt.step()) {
    stmt.free();
    throw new Error('定时任务不存在');
  }

  const schedule = stmt.getAsObject();
  stmt.free();
  return executeSchedule(schedule);
}

module.exports = { startScheduler, triggerSchedule, parseCron, getNextRunTime };
