const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'workflows.db');

let db = null;

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // 尝试加载已存在的数据库
  let data = null;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }
  
  db = new SQL.Database(data);
  
  // 创建任务空间表
  db.run(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    )
  `);
  
  // 创建工作流表（关联任务空间）
  db.run(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (workspaceId) REFERENCES workspaces(id)
    )
  `);
  
  // 创建定时任务表
  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      name TEXT NOT NULL,
      cronExpression TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      lastRunAt TEXT,
      nextRunAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (workflowId) REFERENCES workflows(id)
    )
  `);
  
  // 创建执行日志表
  db.run(`
    CREATE TABLE IF NOT EXISTS execution_logs (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      scheduleId TEXT,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      FOREIGN KEY (workflowId) REFERENCES workflows(id),
      FOREIGN KEY (scheduleId) REFERENCES schedules(id)
    )
  `);

  // 为 execution_logs 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_workflowId ON execution_logs(workflowId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_scheduleId ON execution_logs(scheduleId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_startedAt ON execution_logs(startedAt)');
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON execution_logs(status)');

  // 如果 execution_logs 表已存在但没有 result 列，则添加
  const tableInfo = db.exec("PRAGMA table_info(execution_logs)");
  const hasResultColumn = tableInfo.length > 0 && tableInfo[0].values.some(col => col[1] === 'result');
  if (!hasResultColumn) {
    db.run("ALTER TABLE execution_logs ADD COLUMN result TEXT");
    console.log('已为 execution_logs 表添加 result 列');
  }
  
  // 创建节点执行记录表（每个节点的执行详情）
  db.run(`
    CREATE TABLE IF NOT EXISTS node_executions (
      id TEXT PRIMARY KEY,
      executionId TEXT NOT NULL,
      nodeId TEXT NOT NULL,
      nodeName TEXT,
      nodeType TEXT,
      status TEXT NOT NULL,
      input TEXT,
      output TEXT,
      error TEXT,
      requestInfo TEXT,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      FOREIGN KEY (executionId) REFERENCES execution_logs(id)
    )
  `);

  // 检查并添加 requestInfo 列
  try {
    db.run('ALTER TABLE node_executions ADD COLUMN requestInfo TEXT');
    console.log('已为 node_executions 表添加 requestInfo 列');
  } catch (e) {
    if (!e.message.includes('duplicate column')) {
      console.error('添加 requestInfo 列失败:', e.message);
    }
  }

  // 为 node_executions 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_node_executions_executionId ON node_executions(executionId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_node_executions_nodeId ON node_executions(nodeId)');

  // 创建节点模板表
  db.run(`
    CREATE TABLE IF NOT EXISTS node_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    )
  `);
  
  // 修复双重编码的数据
  fixDoubleEncoding();
  
  // 如果修复后仍有数据损坏，直接重置数据库
  const checkStmt = db.prepare('SELECT id, nodes FROM workflows LIMIT 1');
  if (checkStmt.step()) {
    const row = checkStmt.getAsObject();
    try {
      let nodes = JSON.parse(row.nodes);
      if (typeof nodes === 'string' || !Array.isArray(nodes)) {
        console.log('数据库存在损坏数据，将直接重置...');
        resetDatabase();
      }
    } catch (e) {
      console.log('数据库存在损坏数据，将直接重置...');
      resetDatabase();
    }
  }
  checkStmt.free();
  
  saveDatabase();
  console.log('数据库初始化完成');
  return db;
}

// 修复双重 JSON 编码的数据
function fixDoubleEncoding() {
  // 检查工作流数据是否需要修复
  const stmt = db.prepare('SELECT id, nodes, edges FROM workflows');
  const workflowsToFix = [];
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    try {
      // 尝试解析 nodes
      let nodes = JSON.parse(row.nodes);
      // 如果解析后是字符串，说明是双重编码
      if (typeof nodes === 'string') {
        nodes = JSON.parse(nodes);
      }
      // 如果不是数组，说明解析出问题了
      if (!Array.isArray(nodes)) {
        workflowsToFix.push({ id: row.id, raw: row.nodes });
      }
    } catch (e) {
      // 解析失败，标记为需要修复
      workflowsToFix.push({ id: row.id, raw: row.nodes });
    }
  }
  stmt.free();
  
  // 修复数据
  for (const wf of workflowsToFix) {
    try {
      // 尝试多次解析
      let nodes = wf.raw;
      for (let i = 0; i < 3; i++) {
        try {
          nodes = JSON.parse(nodes);
        } catch (e) {
          break;
        }
      }
      
      if (Array.isArray(nodes)) {
        console.log(`修复工作流 ${wf.id} 的 nodes 数据`);
        db.run('UPDATE workflows SET nodes = ? WHERE id = ?', [JSON.stringify(nodes), wf.id]);
      } else {
        console.log(`工作流 ${wf.id} 数据损坏，无法修复`);
      }
    } catch (e) {
      console.log(`修复工作流 ${wf.id} 失败:`, e.message);
    }
  }
}

// 保存数据库到文件
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDb() {
  return db;
}

function setDb(newDb) {
  db = newDb;
}

// 检查并创建默认工作空间
function ensureDefaultWorkspace() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM workspaces');
  stmt.step();
  const result = stmt.getAsObject();
  stmt.free();
  
  if (result.count === 0) {
    const { v4: uuidv4 } = require('uuid');
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO workspaces (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
      [uuidv4(), '默认工作空间', '系统默认工作空间', now]
    );
    saveDatabase();
    console.log('创建默认工作空间');
  }
}

// 重置数据库（用于测试）
function resetDatabase() {
  const backupPath = dbPath + '.backup.' + Date.now();
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`数据库已备份到: ${backupPath}`);
  }

  db.run('DELETE FROM execution_logs');
  db.run('DELETE FROM node_executions');
  db.run('DELETE FROM schedules');
  db.run('DELETE FROM workflows');
  db.run('DELETE FROM workspaces');
  db.run('DELETE FROM node_templates');

  saveDatabase();
  ensureDefaultWorkspace();
  console.log('数据库已重置');
}

module.exports = { initDatabase, saveDatabase, getDb, setDb, ensureDefaultWorkspace, resetDatabase };

