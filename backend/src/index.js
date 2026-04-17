// 生产环境禁用 console.log（必须放在最顶部）
if (process.env.NODE_ENV === 'production') {
  global.console.log = () => {};
}

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const workspaceRoutes = require('./routes/workspace')
const workflowRoutes = require('./routes/workflow')
const scheduleRoutes = require('./routes/schedule')
const executionRoutes = require('./routes/execution')
const templateRoutes = require('./routes/templates')
const dbRoutes = require('./routes/db')
const { initDatabase, ensureDefaultWorkspace } = require('./db')
const { startScheduler } = require('./scheduler')

const app = express()
const PORT = process.env.PORT || 3001

// 异步启动服务
async function start() {
  // 初始化数据库
  await initDatabase()
  ensureDefaultWorkspace()

  // 中间件
  app.use(cors())
  app.use(express.json())

  // 路由
  app.use('/api/workspaces', workspaceRoutes)
  app.use('/api/workflows', workflowRoutes)
  app.use('/api/schedules', scheduleRoutes)
  app.use('/api/executions', executionRoutes)
  app.use('/api/templates', templateRoutes)
  app.use('/api/db', dbRoutes)

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // 启动定时调度器
  startScheduler()

  app.listen(PORT, () => {
    console.log(`后端服务运行在 http://localhost:${PORT}`)
    console.log('定时任务调度器已启动')
  })
}

start()
