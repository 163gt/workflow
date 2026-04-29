const { getDb, saveDatabase } = require('./db')

// 简单的 cron 解析器
function parseCron(expression) {
  const parts = expression.split(' ')
  if (parts.length !== 5) return null

  const [minute, hour, day, month, week] = parts

  return {
    minute: minute === '*' ? null : minute.startsWith('*/') ? { interval: parseInt(minute.slice(2)) } : parseInt(minute),
    hour: hour === '*' ? null : hour.startsWith('*/') ? { interval: parseInt(hour.slice(2)) } : parseInt(hour),
    day: day === '*' ? null : parseInt(day),
    month: month === '*' ? null : parseInt(month),
    week: week === '*' ? null : parseInt(week)
  }
}

// 检查是否应该执行（给定具体时间点）
function shouldRunAtTime(cron, now) {
  const { minute, hour, day, month, week } = cron

  // 检查分钟
  if (minute !== null) {
    if (typeof minute === 'object' && minute.interval) {
      if (now.getMinutes() % minute.interval !== 0) return false
    } else {
      if (now.getMinutes() !== minute) return false
    }
  }

  // 检查小时
  if (hour !== null) {
    if (typeof hour === 'object' && hour.interval) {
      if (now.getHours() % hour.interval !== 0) return false
    } else {
      if (now.getHours() !== hour) return false
    }
  }

  // 检查日期
  if (day !== null) {
    if (now.getDate() !== day) return false
  }

  // 检查月份
  if (month !== null) {
    if (now.getMonth() + 1 !== month) return false
  }

  // 检查星期
  if (week !== null) {
    if (now.getDay() !== week) return false
  }

  return true
}

// 计算下次执行时间
function getNextRunTime(cron) {
  const now = new Date()
  const next = new Date(now)
  next.setSeconds(0)
  next.setMilliseconds(0)

  const { minute, hour, day, week } = cron

  // 分钟级调度
  if (typeof minute === 'object' && minute.interval) {
    next.setMinutes(next.getMinutes() + minute.interval)
    return next.toISOString()
  }

  // 每天调度（如每天17:00）
  if (hour !== null && day === null && week === null) {
    next.setMinutes(minute !== null ? minute : 0)
    next.setHours(hour)
    next.setSeconds(0)

    // 如果目标时间已过，加1天
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    return next.toISOString()
  }

  // 每X小时调度
  if (typeof hour === 'object' && hour.interval) {
    next.setMinutes(0)
    next.setHours(next.getHours() + hour.interval)
    return next.toISOString()
  }

  // 每周调度
  if (week !== null) {
    const currentDay = now.getDay()
    const daysUntilTarget = (week - currentDay + 7) % 7 || 7
    next.setDate(next.getDate() + daysUntilTarget)
    next.setHours(hour !== null ? hour : 0)
    next.setMinutes(minute !== null ? minute : 0)
    return next.toISOString()
  }

  // 每月调度
  if (day !== null) {
    next.setMonth(next.getMonth() + 1)
    next.setDate(day)
    next.setHours(hour !== null ? hour : 0)
    next.setMinutes(minute !== null ? minute : 0)
    return next.toISOString()
  }

  // 默认每分钟
  next.setMinutes(next.getMinutes() + 1)
  return next.toISOString()
}

// 获取 API 服务地址
function getApiUrl() {
  return process.env.API_URL || 'http://localhost:3001'
}

// 执行单个定时任务 - 通过调用立即执行的 API 实现
async function executeSchedule(schedule) {
  console.log(`[调度器] 执行任务: ${schedule.name} (${schedule.id})`)

  // 创建执行日志（记录定时任务触发的执行）
  const db = getDb()
  const executionId = require('uuid').v4()
  const startedAt = new Date().toISOString()

  db.run(
    'INSERT INTO execution_logs (id, workflowId, scheduleId, status, startedAt) VALUES (?, ?, ?, ?, ?)',
    [executionId, schedule.workflowId, schedule.id, 'running', startedAt]
  )
  saveDatabase()

  try {
    // 通过 HTTP 调用立即执行的 API
    const apiUrl = getApiUrl()
    const response = await fetch(`${apiUrl}/api/workflows/${schedule.workflowId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(480000) // 8分钟超时
    })

    const result = await response.json()

    // 更新执行日志
    const finishedAt = new Date().toISOString()
    const status = result.status || (response.ok ? 'success' : 'failed')

    db.run(
      'UPDATE execution_logs SET status = ?, result = ?, error = ?, finishedAt = ? WHERE id = ?',
      [status, JSON.stringify(result.results), result.error, finishedAt, executionId]
    )

    // 更新定时任务最后执行时间
    const now = new Date().toISOString()
    const cron = parseCron(schedule.cronExpression)
    const nextRunAt = cron ? getNextRunTime(cron) : null

    db.run(
      'UPDATE schedules SET lastRunAt = ?, nextRunAt = ? WHERE id = ?',
      [now, nextRunAt, schedule.id]
    )

    saveDatabase()

    console.log(`[调度器] 任务执行完成: ${schedule.name}, 状态: ${status}`)

    return {
      status,
      results: result.results,
      error: result.error,
      executionId: result.id
    }
  } catch (error) {
    console.error(`[调度器] 任务执行失败: ${schedule.name}, 错误: ${error.message}`)

    const finishedAt = new Date().toISOString()
    db.run(
      'UPDATE execution_logs SET status = ?, error = ?, finishedAt = ? WHERE id = ?',
      ['failed', error.message, finishedAt, executionId]
    )
    saveDatabase()

    return { status: 'failed', error: error.message }
  }
}

// 上次检查时间（用于检测漏执行的任务）
let lastCheckedAt = null

// 检查间隔（毫秒）
const intervalMs = 20 * 60 * 1000

// 检查并执行到期的定时任务
function checkAndExecuteSchedules() {
  const db = getDb()
  const now = new Date()

  // 获取所有已启用的定时任务
  const stmt = db.prepare('SELECT * FROM schedules WHERE enabled = 1')
  const schedules = []
  while (stmt.step()) {
    schedules.push(stmt.getAsObject())
  }
  stmt.free()

  for (const schedule of schedules) {
    const cron = parseCron(schedule.cronExpression)
    if (!cron) continue

    // 检查当前时间是否应该执行
    if (shouldRunAtTime(cron, now)) {
      setImmediate(() => executeSchedule(schedule))
      continue
    }

    // 检查是否有漏执行的任务（从上次检查到现在的间隔内）
    if (lastCheckedAt) {
      const checkStart = new Date(Math.max(lastCheckedAt.getTime(), now.getTime() - intervalMs))
      // 遍历检查间隔内的每分钟
      for (let t = new Date(checkStart); t < now; t.setMinutes(t.getMinutes() + 1)) {
        if (shouldRunAtTime(cron, t)) {
          setImmediate(() => executeSchedule(schedule))
          break  // 只补执行一次
        }
      }
    }
  }

  lastCheckedAt = now
}

// 启动调度器
function startScheduler() {
  console.log('[调度器] 初始化定时任务调度器...')

  // 延迟10秒启动，等待服务完全就绪
  setTimeout(() => {
    checkAndExecuteSchedules()
  }, 10000)

  // 设置定时检查
  setInterval(checkAndExecuteSchedules, intervalMs)

  console.log(`[调度器] 调度器已启动，每 ${intervalMs / 1000} 秒检查一次定时任务`)
}

// 手动触发定时任务（从 schedule.js 调用）
async function triggerSchedule(scheduleId) {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM schedules WHERE id = ?')
  stmt.bind([scheduleId])

  if (!stmt.step()) {
    stmt.free()
    throw new Error('定时任务不存在')
  }

  const schedule = stmt.getAsObject()
  stmt.free()

  return await executeSchedule(schedule)
}

module.exports = { startScheduler, triggerSchedule }
