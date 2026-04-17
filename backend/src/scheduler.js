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

// 检查是否应该执行
function shouldRun(cron, now) {
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
  
  // 小时级调度
  if (hour !== null && day === null && week === null) {
    if (typeof hour === 'object' && hour.interval) {
      next.setMinutes(0)
      next.setHours(next.getHours() + hour.interval)
    } else {
      next.setMinutes(minute !== null ? minute : 0)
      next.setHours(hour)
    }
    return next.toISOString()
  }
  
  // 每天调度
  if (day === null && week === null) {
    next.setDate(next.getDate() + 1)
    next.setHours(hour !== null ? hour : 0)
    next.setMinutes(minute !== null ? minute : 0)
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

// 执行单个定时任务
async function executeSchedule(schedule) {
  const db = getDb()

  console.log(`[调度器] 执行任务: ${schedule.name} (${schedule.id})`)

  // 创建执行日志
  const executionId = require('uuid').v4()
  const startedAt = new Date().toISOString()

  db.run(
    'INSERT INTO execution_logs (id, workflowId, scheduleId, status, startedAt) VALUES (?, ?, ?, ?, ?)',
    [executionId, schedule.workflowId, schedule.id, 'running', startedAt]
  )

  try {
    // 获取工作流
    const wfStmt = db.prepare('SELECT * FROM workflows WHERE id = ?')
    wfStmt.bind([schedule.workflowId])

    if (!wfStmt.step()) {
      throw new Error('工作流不存在')
    }

    const workflow = wfStmt.getAsObject()
    wfStmt.free()

    const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes
    const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges

    // 执行工作流 - 使用和手动执行相同的逻辑
    const results = {}
    let errorMessage = null
    const nodeExecutions = []

    try {
      const nodeMap = new Map(nodes.map(n => [n.id, n]))
      const startNode = nodes.find(n => n.type === 'start')

      if (!startNode) {
        errorMessage = '工作流缺少开始节点'
      } else {
        const visited = new Set()
        const queue = [startNode.id]
        const nodeInputMap = { [startNode.id]: {} }

        while (queue.length > 0) {
          const nodeId = queue.shift()

          if (visited.has(nodeId)) continue
          visited.add(nodeId)

          const node = nodeMap.get(nodeId)
          if (!node) continue

          const input = nodeInputMap[nodeId] || {}
          let result = null
          let nodeStatus = 'success'
          let nodeError = null

          if (node.type === 'http') {
            const { method, url, headers, body } = node.data || {}

            if (!url || !url.trim()) {
              errorMessage = `节点 "${node.data?.label || nodeId}" 的 URL 不能为空`
              nodeStatus = 'failed'
              nodeError = errorMessage
            } else {
              const cleanUrl = url.trim()

              try {
                const headerObj = JSON.parse(headers || '{}')
                const options = {
                  method: method || 'GET',
                  headers: headerObj,
                  signal: AbortSignal.timeout(480000)
                }
                if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
                  options.body = body
                }

                const response = await fetch(cleanUrl, options)
                const text = await response.text()
                result = {
                  status: response.status,
                  statusText: response.statusText,
                  body: text
                }
              } catch (err) {
                errorMessage = `节点 "${node.data?.label || nodeId}" HTTP请求失败: ${err.message}`
                nodeStatus = 'failed'
                nodeError = errorMessage
              }
            }
          } else if (node.type === 'dataProcess') {
            const { code } = node.data || {}
            try {
              const fn = new Function('input', code || 'return input')
              result = fn(input)
            } catch (err) {
              errorMessage = `节点 "${node.data?.label || nodeId}" 脚本执行失败: ${err.message}`
              nodeStatus = 'failed'
              nodeError = errorMessage
            }
          } else if (node.type === 'condition') {
            const conditions = node.data?.conditions || [null, null]
            const cond1 = conditions[0]
            const cond2 = conditions[1]

            const inputValue = (() => {
              if (input && typeof input === 'object') {
                if (input.status !== undefined) return input.status
                if (input.result !== undefined) return input.result
                if (input.value !== undefined) return input.value
              }
              return input
            })()

            const evaluateCondition = (cond, val) => {
              if (!cond?.expression) return null
              try {
                let expr = cond.expression.trim()
                if (expr.endsWith(';')) {
                  expr = expr.slice(0, -1)
                }
                const condFn = new Function('input', `try { return !!(${expr}) } catch(e) { return false; }`)
                return condFn(val)
              } catch {
                return null
              }
            }

            const cond1Result = evaluateCondition(cond1, input)
            const cond2Result = evaluateCondition(cond2, input)

            console.log('=== 条件节点评估 (scheduler) ===')
            console.log('原始输入:', JSON.stringify(input))
            console.log('input.status:', input?.status)
            console.log('条件1表达式:', cond1?.expression)
            console.log('条件1结果:', cond1Result)
            console.log('条件2表达式:', cond2?.expression)
            console.log('条件2结果:', cond2Result)

            result = { cond1: cond1Result, cond2: cond2Result, input: inputValue, originalInput: input }
          } else if (node.type === 'start' || node.type === 'end') {
            result = input
          } else if (node.type === 'saveFile') {
            const { fileName, dirPath } = node.data || {}
            console.log('保存文件:', fileName, dirPath, input)
            try {
              const fs = require('fs')
              const path = require('path')
              if (!fileName) {
                errorMessage = `节点 "${node.data?.label || nodeId}" 文件名不能为空`
                nodeStatus = 'failed'
                nodeError = errorMessage
              } else {
                const targetDir = dirPath || path.join(process.cwd(), 'outputs')
                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true })
                }
                // 文件名可能包含或不包含 .json 后缀，确保使用完整文件名
                const finalFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`
                const fullPath = path.join(targetDir, `${fileName}.json`)
                fs.writeFileSync(fullPath, JSON.stringify(input, null, 2), 'utf8')
                console.log('文件保存成功:', fullPath)
                result = {
                  ...input,
                  _file: {
                    success: true,
                    fileName: finalFileName,
                    fullPath: fullPath,
                    savedAt: new Date().toISOString()
                  }
                }
              }
            } catch (err) {
              errorMessage = `节点 "${node.data?.label || nodeId}" 保存文件失败: ${err.message}`
              console.log('保存文件错误:', err.message)
              nodeStatus = 'failed'
              nodeError = errorMessage
            }
          }

          results[node.id] = result

          // 记录节点执行
          nodeExecutions.push({
            nodeId: node.id,
            nodeName: node.data?.label || node.id,
            nodeType: node.type,
            status: nodeStatus,
            input: input,
            output: result,
            error: nodeError,
            startedAt: startedAt
          })

          // 如果出错，停止执行
          if (errorMessage) break

          // 根据节点类型处理分支
          const outgoingEdges = edges.filter(e => e.source === nodeId)

          if (node.type === 'condition' && result) {
            if (result.cond1) {
              const edge1 = outgoingEdges.find(e => e.sourceHandle === 'yes')
              if (edge1 && !visited.has(edge1.target)) {
                nodeInputMap[edge1.target] = input || result.originalInput || result.input || {}
                queue.push(edge1.target)
              }
            }
            if (result.cond2) {
              const edge2 = outgoingEdges.find(e => e.sourceHandle === 'no')
              if (edge2 && !visited.has(edge2.target)) {
                nodeInputMap[edge2.target] = input || result.originalInput || result.input || {}
                queue.push(edge2.target)
              }
            }
          } else {
            for (const edge of outgoingEdges) {
              if (!visited.has(edge.target)) {
                nodeInputMap[edge.target] = result || {}
                queue.push(edge.target)
              }
            }
          }
        }
      }
    } catch (err) {
      errorMessage = err.message
    }

    const finishedAt = new Date().toISOString()
    const status = errorMessage ? 'failed' : 'success'

    // 更新执行日志
    db.run(
      'UPDATE execution_logs SET status = ?, result = ?, error = ?, finishedAt = ? WHERE id = ?',
      [status, JSON.stringify(results), errorMessage, finishedAt, executionId]
    )

    // 保存节点执行记录
    for (const nodeExec of nodeExecutions) {
      const nodeExecId = require('uuid').v4()
      db.run(
        'INSERT INTO node_executions (id, executionId, nodeId, nodeName, nodeType, status, input, output, error, startedAt, finishedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nodeExecId, executionId, nodeExec.nodeId, nodeExec.nodeName, nodeExec.nodeType, nodeExec.status, JSON.stringify(nodeExec.input), nodeExec.output ? JSON.stringify(nodeExec.output) : null, nodeExec.error, nodeExec.startedAt, finishedAt]
      )
    }

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

    return { status, results, error: errorMessage }
  } catch (error) {
    console.error(`[调度器] 任务执行失败: ${schedule.name}, 错误: ${error.message}`)

    db.run(
      'UPDATE execution_logs SET status = ?, error = ?, finishedAt = ? WHERE id = ?',
      ['failed', error.message, new Date().toISOString(), executionId]
    )
    saveDatabase()

    return { status: 'failed', error: error.message }
  }
}

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
    
    if (shouldRun(cron, now)) {
      // 使用 setTimeout 非阻塞执行
      setImmediate(() => executeSchedule(schedule))
    }
  }
}

// 启动调度器
function startScheduler() {
  console.log('[调度器] 初始化定时任务调度器...')
  
  // 每分钟检查一次
  const intervalMs = 60 * 1000
  
  // 立即执行一次检查
  setTimeout(() => {
    checkAndExecuteSchedules()
  }, 5000) // 延迟5秒启动
  
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
