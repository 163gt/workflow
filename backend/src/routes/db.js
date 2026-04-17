const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const { getDb } = require('../db')

// 数据库文件路径
const dbPath = path.join(__dirname, '..', '..', 'data', 'workflows.db')

// 获取备份目录
function getBackupsDir() {
  const dir = path.dirname(dbPath)
  const backupsDir = path.join(dir, 'backups')

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  return backupsDir
}

// 获取数据库信息
router.get('/info', (req, res) => {
  try {
    const stats = fs.statSync(dbPath)

    const db = getDb()
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'").length

    res.json({
      path: dbPath,
      size: stats.size,
      tables: tables
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取备份列表
router.get('/backups', (req, res) => {
  try {
    const backupsDir = getBackupsDir()
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const filepath = path.join(backupsDir, f)
        const stats = fs.statSync(filepath)
        return {
          name: f,
          size: stats.size,
          time: stats.mtime.toLocaleString('zh-CN')
        }
      })
      .sort((a, b) => b.time.localeCompare(a.time))

    res.json(files)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 创建备份
router.post('/backup', (req, res) => {
  try {
    const db = getDb()

    // 导出数据库数据
    const data = db.export()
    const buffer = Buffer.from(data)

    const backupsDir = getBackupsDir()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFilename = `backup-${timestamp}.db`
    const backupPath = path.join(backupsDir, backupFilename)

    // 保存备份文件
    fs.writeFileSync(backupPath, buffer)

    res.json({
      status: 'success',
      filename: backupFilename,
      path: backupPath,
      size: buffer.length
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 下载备份
router.get('/backup/:filename', (req, res) => {
  try {
    const { filename } = req.params
    const backupsDir = getBackupsDir()
    const filepath = path.join(backupsDir, filename)

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: '文件不存在' })
    }

    res.download(filepath, filename)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 删除备份
router.delete('/backup/:filename', (req, res) => {
  try {
    const { filename } = req.params
    const backupsDir = getBackupsDir()
    const filepath = path.join(backupsDir, filename)

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: '文件不存在' })
    }

    fs.unlinkSync(filepath)
    res.json({ status: 'success' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
