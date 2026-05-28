const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'workflows.db');

let db = null;

function ensureColumn(tableName, columnName, definition) {
  try {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  } catch (e) {
    if (!e.message.includes('duplicate column')) {
      console.error(`添加 ${tableName}.${columnName} 失败:`, e.message);
    }
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();

  let data = null;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }

  db = new SQL.Database(data);

  db.run(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      workspaceId TEXT NOT NULL,
      name TEXT NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      paramsSchema TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (workspaceId) REFERENCES workspaces(id)
    )
  `);

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

  db.run(`
    CREATE TABLE IF NOT EXISTS execution_logs (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      scheduleId TEXT,
      paramSetId TEXT,
      batchJobId TEXT,
      batchItemId TEXT,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      paramsSnapshot TEXT,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      FOREIGN KEY (workflowId) REFERENCES workflows(id),
      FOREIGN KEY (scheduleId) REFERENCES schedules(id)
    )
  `);

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

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_param_sets (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      name TEXT NOT NULL,
      params TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT,
      FOREIGN KEY (workflowId) REFERENCES workflows(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      name TEXT NOT NULL,
      intervalSeconds INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      finishedAt TEXT,
      FOREIGN KEY (workflowId) REFERENCES workflows(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batch_job_items (
      id TEXT PRIMARY KEY,
      batchJobId TEXT NOT NULL,
      workflowId TEXT NOT NULL,
      paramSetId TEXT NOT NULL,
      executionId TEXT,
      sequence INTEGER NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      createdAt TEXT NOT NULL,
      startedAt TEXT,
      finishedAt TEXT,
      FOREIGN KEY (batchJobId) REFERENCES batch_jobs(id),
      FOREIGN KEY (workflowId) REFERENCES workflows(id),
      FOREIGN KEY (paramSetId) REFERENCES workflow_param_sets(id)
    )
  `);

  ensureColumn('workflows', 'paramsSchema', "TEXT DEFAULT '[]'");
  ensureColumn('execution_logs', 'result', 'TEXT');
  ensureColumn('execution_logs', 'paramSetId', 'TEXT');
  ensureColumn('execution_logs', 'batchJobId', 'TEXT');
  ensureColumn('execution_logs', 'batchItemId', 'TEXT');
  ensureColumn('execution_logs', 'paramsSnapshot', 'TEXT');
  ensureColumn('node_executions', 'requestInfo', 'TEXT');

  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_workflowId ON execution_logs(workflowId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_scheduleId ON execution_logs(scheduleId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_startedAt ON execution_logs(startedAt)');
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON execution_logs(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_paramSetId ON execution_logs(paramSetId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_execution_logs_batchJobId ON execution_logs(batchJobId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_node_executions_executionId ON node_executions(executionId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_node_executions_nodeId ON node_executions(nodeId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_workflow_param_sets_workflowId ON workflow_param_sets(workflowId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_batch_jobs_workflowId ON batch_jobs(workflowId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_batch_job_items_batchJobId ON batch_job_items(batchJobId)');

  fixDoubleEncoding();

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

function fixDoubleEncoding() {
  const stmt = db.prepare('SELECT id, nodes, edges FROM workflows');
  const workflowsToFix = [];

  while (stmt.step()) {
    const row = stmt.getAsObject();
    try {
      let nodes = JSON.parse(row.nodes);
      if (typeof nodes === 'string') {
        nodes = JSON.parse(nodes);
      }
      if (!Array.isArray(nodes)) {
        workflowsToFix.push({ id: row.id, raw: row.nodes });
      }
    } catch (e) {
      workflowsToFix.push({ id: row.id, raw: row.nodes });
    }
  }
  stmt.free();

  for (const workflow of workflowsToFix) {
    try {
      let nodes = workflow.raw;
      for (let i = 0; i < 3; i += 1) {
        try {
          nodes = JSON.parse(nodes);
        } catch (e) {
          break;
        }
      }

      if (Array.isArray(nodes)) {
        console.log(`修复工作流 ${workflow.id} 的 nodes 数据`);
        db.run('UPDATE workflows SET nodes = ? WHERE id = ?', [JSON.stringify(nodes), workflow.id]);
      } else {
        console.log(`工作流 ${workflow.id} 数据损坏，无法修复`);
      }
    } catch (e) {
      console.log(`修复工作流 ${workflow.id} 失败:`, e.message);
    }
  }
}

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

function resetDatabase() {
  const backupPath = `${dbPath}.backup.${Date.now()}`;
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`数据库已备份到 ${backupPath}`);
  }

  db.run('DELETE FROM execution_logs');
  db.run('DELETE FROM node_executions');
  db.run('DELETE FROM batch_job_items');
  db.run('DELETE FROM batch_jobs');
  db.run('DELETE FROM workflow_param_sets');
  db.run('DELETE FROM schedules');
  db.run('DELETE FROM workflows');
  db.run('DELETE FROM workspaces');
  db.run('DELETE FROM node_templates');

  saveDatabase();
  ensureDefaultWorkspace();
  console.log('数据库已重置');
}

module.exports = { initDatabase, saveDatabase, getDb, setDb, ensureDefaultWorkspace, resetDatabase };
