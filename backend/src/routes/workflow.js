const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');

// 获取指定任务空间的所有工作流
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const workspaceId = req.query.workspaceId;
    
    let sql = 'SELECT * FROM workflows';
    let params = [];
    if (workspaceId) {
      sql += ' WHERE workspaceId = ?';
      params = [workspaceId];
    }
    sql += ' ORDER BY createdAt DESC';
    
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    
    const workflows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      workflows.push({
        ...row,
        nodes: JSON.parse(row.nodes),
        edges: JSON.parse(row.edges)
      });
    }
    stmt.free();
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个工作流
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
    stmt.bind([req.params.id]);
    
    if (stmt.step()) {
      const workflow = stmt.getAsObject();
      stmt.free();
      res.json({
        ...workflow,
        nodes: JSON.parse(workflow.nodes),
        edges: JSON.parse(workflow.edges)
      });
    } else {
      stmt.free();
      res.status(404).json({ error: '工作流不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建工作流
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { workspaceId, name, nodes, edges } = req.body;
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    
    // 前端已经 JSON.stringify 了，所以这里不需要再 stringify
    const nodesStr = typeof nodes === 'string' ? nodes : JSON.stringify(nodes || []);
    const edgesStr = typeof edges === 'string' ? edges : JSON.stringify(edges || []);
    
    db.run(
      'INSERT INTO workflows (id, workspaceId, name, nodes, edges, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, workspaceId, name || '新工作流', nodesStr, edgesStr, createdAt]
    );
    
    saveDatabase();
    
    const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
    stmt.bind([id]);
    stmt.step();
    const workflow = stmt.getAsObject();
    stmt.free();
    
    res.status(201).json({
      ...workflow,
      nodes: JSON.parse(workflow.nodes),
      edges: JSON.parse(workflow.edges)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新工作流
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, nodes, edges } = req.body;
    console.log('更新工作流:', req.params.id, 'nodes数量:', nodes?.length, 'edges数量:', edges?.length);
    console.log('节点数据:', JSON.stringify(nodes).substring(0, 200));
    const updatedAt = new Date().toISOString();
    
    // 前端已经 JSON.stringify 了，所以这里不需要再 stringify
    // 直接存储即可
    const nodesStr = typeof nodes === 'string' ? nodes : JSON.stringify(nodes);
    const edgesStr = typeof edges === 'string' ? edges : JSON.stringify(edges);
    
    db.run(
      'UPDATE workflows SET name = ?, nodes = ?, edges = ?, updatedAt = ? WHERE id = ?',
      [name, nodesStr, edgesStr, updatedAt, req.params.id]
    );
    
    saveDatabase();
    
    const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
    stmt.bind([req.params.id]);
    
    if (stmt.step()) {
      const workflow = stmt.getAsObject();
      stmt.free();
      res.json({
        ...workflow,
        nodes: JSON.parse(workflow.nodes),
        edges: JSON.parse(workflow.edges)
      });
    } else {
      stmt.free();
      res.status(404).json({ error: '工作流不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除工作流（同时删除关联的定时任务、执行日志和节点执行记录）
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const workflowId = req.params.id;

    // 先删除关联的节点执行记录（通过执行日志关联）
    db.run('DELETE FROM node_executions WHERE executionId IN (SELECT id FROM execution_logs WHERE workflowId = ?)', [workflowId]);
    // 删除关联的定时任务
    db.run('DELETE FROM schedules WHERE workflowId = ?', [workflowId]);
    // 删除关联的执行日志
    db.run('DELETE FROM execution_logs WHERE workflowId = ?', [workflowId]);
    // 删除工作流
    db.run('DELETE FROM workflows WHERE id = ?', [workflowId]);

    saveDatabase();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 执行工作流
router.post('/:id/execute', async (req, res) => {
  try {
    const db = getDb();
    const workflowId = req.params.id;
    
    // 获取工作流
    const wfStmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
    wfStmt.bind([workflowId]);
    
    if (!wfStmt.step()) {
      wfStmt.free();
      return res.status(404).json({ error: '工作流不存在' });
    }
    
    const workflow = wfStmt.getAsObject();
    wfStmt.free();
    
    const nodes = JSON.parse(workflow.nodes);
    const edges = JSON.parse(workflow.edges);
    
    console.log('=== 执行工作流 ===');
    console.log('工作流ID:', workflowId);
    console.log('节点数量:', nodes.length);
    console.log('边数量:', edges.length);
    console.log('节点列表:', nodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label })));
    console.log('边列表:', edges.map(e => ({ source: e.source, target: e.target })));
    
    // 创建执行日志
    const executionId = uuidv4();
    const startedAt = new Date().toISOString();
    
    db.run(
      'INSERT INTO execution_logs (id, workflowId, status, startedAt) VALUES (?, ?, ?, ?)',
      [executionId, workflowId, 'running', startedAt]
    );
    
    // 执行工作流
    const results = {};
    let errorMessage = null;
    const nodeExecutions = []; // 收集节点执行记录
    
    try {
      // 构建拓扑顺序 - 从开始节点开始，按边的连接顺序执行
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      const startNode = nodes.find(n => n.type === 'start');
      
      console.log('开始节点:', startNode?.id);
      
      if (!startNode) {
        errorMessage = '工作流缺少开始节点';
      } else {
        // BFS/DFS 遍历 - 从开始节点出发，按边顺序执行
        const visited = new Set();
        const queue = [startNode.id];
        const nodeInputMap = {}; // 记录每个节点的输入
        
        // 开始节点的输入为空
        nodeInputMap[startNode.id] = {};
        
        while (queue.length > 0) {
          const nodeId = queue.shift();
          
          if (visited.has(nodeId)) {
            console.log('跳过已访问节点:', nodeId);
            continue;
          }
          visited.add(nodeId);
          
          const node = nodeMap.get(nodeId);
          if (!node) {
            console.log('节点不存在:', nodeId);
            continue;
          }
          
          console.log('处理节点:', node.id, node.type, node.data?.label);
          
          // 获取当前节点的输入（来自前一个节点的输出）
          const input = nodeInputMap[nodeId] || {};
          
          let result = null;
          let nodeStatus = 'success';
          let nodeError = null;
          let nodeRequestInfo = null;
          
          // 只处理需要执行的节点类型
          if (node.type === 'http') {
            const { method, url, headers, body } = node.data || {};
            
            // 模板解析函数：支持 {{input.xxx}} 和 ${input.xxx} 语法
            // 功能：替换模板占位符为 input 中的实际值
            // 输入值如果是基本类型（字符串、数字等），替换后直接使用
            // 输入值如果是对象，通过模板引用得到字符串后再 JSON.parse
            const resolveTemplate = (template, inputData) => {
              if (template === null || template === undefined) return template;
              if (typeof template !== 'string') return template;

              let resolved = template;
              const patterns = [
                /\{\{input\.([^}]+)\}\}/g,
                /\$\{input\.([^}]+)\}/g
              ];

              for (const pattern of patterns) {
                resolved = resolved.replace(pattern, (match, path) => {
                  try {
                    const value = path.split('.').reduce((obj, key) => obj?.[key], inputData);
                    if (value !== undefined) return String(value);
                    return match;
                  } catch {
                    return match;
                  }
                });
              }
              return resolved;
            };
            
            // 解析 url（直接使用原始值或模板替换结果）
            const resolvedUrl = resolveTemplate(url, input);
            
            // 检查模板是否被完全解析（防止 {{input.xxx}} 未被替换导致 fetch 失败）
            const templatePattern = /\{\{input\.[^}]+\}\}|\$\{input\.[^}]+\}/g;
            const unresolvedTemplates = resolvedUrl?.match(templatePattern) || [];
            if (unresolvedTemplates.length > 0) {
              errorMessage = `节点 "${node.data?.label || nodeId}" 的 URL 包含未解析的变量: ${unresolvedTemplates.join(', ')}`;
              console.log('URL模板未解析:', unresolvedTemplates);
              nodeStatus = 'failed';
              nodeError = errorMessage;
            } else if (!resolvedUrl || !resolvedUrl.trim()) {
              errorMessage = `节点 "${node.data?.label || nodeId}" 的 URL 不能为空`;
              console.log('URL为空，跳出');
              nodeStatus = 'failed';
              nodeError = errorMessage;
            } else {
              const cleanUrl = resolvedUrl.trim();
              
              try {
                // 解析 headers：模板替换后，尝试解析为 JSON 对象
                const resolvedHeaders = resolveTemplate(headers, input);
                let headerObj = {};
                if (typeof resolvedHeaders === 'object' && resolvedHeaders !== null) {
                  headerObj = resolvedHeaders;
                } else if (typeof resolvedHeaders === 'string' && resolvedHeaders.trim()) {
                  headerObj = JSON.parse(resolvedHeaders);
                }
                
                // 解析 body：模板替换后，直接作为请求体字符串
                const resolvedBody = resolveTemplate(body, input);
                let bodyContent = null;
                if (typeof resolvedBody === 'object' && resolvedBody !== null) {
                  bodyContent = JSON.stringify(resolvedBody);
                } else if (typeof resolvedBody === 'string') {
                  bodyContent = resolvedBody;
                }
                
                // 详细打印请求信息
                console.log('\n========== HTTP 请求信息 ==========');
                console.log('请求地址:', cleanUrl);
                console.log('请求方法:', method || 'GET');
                console.log('请求头:', JSON.stringify(headerObj, null, 2));
                if (bodyContent) {
                  console.log('请求体:', bodyContent);
                } else {
                  console.log('请求体: (无)');
                }
                console.log('==================================\n');
                
                const options = {
                  method: method || 'GET',
                  headers: headerObj,
                  signal: AbortSignal.timeout(480000)
                };
                if (bodyContent && ['POST', 'PUT', 'PATCH'].includes(method)) {
                  options.body = bodyContent;
                }
                
                const response = await fetch(cleanUrl, options);
                const text = await response.text();

                // 生成 curl 命令
                const curlParts = [`curl -X ${method || 'GET'}`];
                for (const [key, value] of Object.entries(headerObj)) {
                  curlParts.push(`  -H '${key}: ${value}'`);
                }
                if (bodyContent) {
                  curlParts.push(`  -d '${bodyContent}'`);
                }
                curlParts.push(`  '${cleanUrl}'`);
                const curlCommand = curlParts.join(' \\\n');

                result = {
                  status: response.status,
                  statusText: response.statusText,
                  body: text,
                  _raw: {
                    url: cleanUrl,
                    headers: headerObj,
                    body: bodyContent
                  }
                };

                // 保存请求信息供记录
                nodeRequestInfo = curlCommand;
              } catch (err) {
                errorMessage = `节点 "${node.data?.label || nodeId}" HTTP请求失败: ${err.message}`;
                console.log('HTTP错误:', err.message);
                nodeStatus = 'failed';
                nodeError = errorMessage;
              }
            }
          } else if (node.type === 'dataProcess') {
            const { code } = node.data || {};
            console.log('数据处理脚本:', code);
            console.log('输入数据:', input);
            try {
              const fn = new Function('input', code || 'return input');
              result = fn(input);
              console.log('执行结果:', result);
            } catch (err) {
              errorMessage = `节点 "${node.data?.label || nodeId}" 脚本执行失败: ${err.message}`;
              console.log('脚本错误:', err.message);
              nodeStatus = 'failed';
              nodeError = errorMessage;
            }
          } else if (node.type === 'condition') {
            // 条件节点：两个条件独立评估，每个条件满足则对应输出点输出
            const conditions = node.data?.conditions || [null, null];
            const cond1 = conditions[0];
            const cond2 = conditions[1];

            console.log('条件数据:', JSON.stringify(conditions));
            console.log('条件1对象:', cond1);
            console.log('条件1表达式:', cond1?.expression);
            console.log('条件1表达式类型:', typeof cond1?.expression);
            console.log('条件1表达式长度:', cond1?.expression?.length);

            // 处理输入数据，支持直接返回数字或对象
            const inputValue = (() => {
              // 如果 input 是对象，尝试获取常见的结果字段
              if (input && typeof input === 'object') {
                if (input.status !== undefined) return input.status; // HTTP status
                if (input.result !== undefined) return input.result;
                if (input.value !== undefined) return input.value;
              }
              return input;
            })();

            const evaluateCondition = (cond, rawInput) => {
              if (!cond?.expression) return null;
              try {
                // 移除表达式末尾的分号，避免语法错误
                let expr = cond.expression.trim();
                if (expr.endsWith(';')) {
                  expr = expr.slice(0, -1);
                }
                // 直接使用原始输入对象作为变量执行表达式
                const condFn = new Function('input', `try { return !!(${expr}) } catch(e) { console.log('条件函数错误:', e.message); return false; }`);
                return condFn(rawInput);
              } catch (err) {
                console.log('条件评估错误:', err.message);
                return null;
              }
            };

            const cond1Result = evaluateCondition(cond1, input);
            const cond2Result = evaluateCondition(cond2, input);

            console.log('=== 条件节点评估 ===');
            console.log('原始输入:', input);
            console.log('解析后的值:', inputValue);
            console.log('条件1表达式:', cond1?.expression);
            console.log('条件1结果:', cond1Result);
            console.log('条件2表达式:', cond2?.expression);
            console.log('条件2结果:', cond2Result);

            result = {
              cond1: cond1Result,
              cond2: cond2Result,
              input: inputValue,
              originalInput: input  // 保存原始输入，供后续节点使用
            };
            console.log('条件节点结果:', result);
          } else if (node.type === 'start' || node.type === 'end') {
            // 开始和结束节点不执行，返回输入作为输出
            result = input;
          } else if (node.type === 'saveFile') {
            // 保存JSON文件节点
            let { fileName, dirPath } = node.data || {};

            // 模板解析函数：支持 {{input.xxx}} 和 ${input.xxx} 语法
            const resolveTemplate = (template, inputData) => {
              if (template === null || template === undefined) return template;
              if (typeof template !== 'string') return template;

              let resolved = template;
              const patterns = [
                /\{\{input\.([^}]+)\}\}/g,
                /\$\{input\.([^}]+)\}/g
              ];

              for (const pattern of patterns) {
                resolved = resolved.replace(pattern, (match, path) => {
                  try {
                    const value = path.split('.').reduce((obj, key) => obj?.[key], inputData);
                    if (value !== undefined) return String(value);
                    return match;
                  } catch {
                    return match;
                  }
                });
              }
              return resolved;
            };

            // 解析文件名字段
            fileName = resolveTemplate(fileName, input);
            // 解析目录路径字段（标准化路径：将反斜杠替换为正斜杠）
            dirPath = resolveTemplate(dirPath, input);
            if (dirPath) {
              dirPath = dirPath.replace(/\\/g, '/');
            }

            // 解析保存内容字段：如果模板引用的值是对象，直接返回对象
            let { fileContent } = node.data || {};
            let parsedFileContent = fileContent;
            if (typeof fileContent === 'string') {
              const patterns = [
                /\{\{input\.([^}]+)\}\}/g,
                /\$\{input\.([^}]+)\}/g,
                /\{\{input\}\}/g,
                /\$\{input\}/g
              ];
              for (const pattern of patterns) {
                const match = fileContent.match(pattern);
                if (match) {
                  let path = match[0].replace(/[${}]/g, '').replace('input.', '');
                  if (path === 'input') path = '';
                  const value = path === '' ? input : path.split('.').reduce((obj, key) => obj?.[key], input);
                  if (value !== undefined && typeof value === 'object') {
                    parsedFileContent = value;
                  } else {
                    parsedFileContent = resolveTemplate(fileContent, input);
                  }
                  break;
                }
              }
            }

            console.log('保存文件:', fileName, dirPath, '内容:', parsedFileContent);
            try {
              const fs = require('fs');
              const path = require('path');

              if (!fileName) {
                errorMessage = `节点 "${node.data?.label || nodeId}" 文件名不能为空`;
                nodeStatus = 'failed';
                nodeError = errorMessage;
              } else {
                // 确保目录存在
                const targetDir = dirPath || path.join(process.cwd(), 'outputs');
                if (!fs.existsSync(targetDir)) {
                  fs.mkdirSync(targetDir, { recursive: true });
                }

                // 文件名可能包含或不包含 .json 后缀，统一处理
                const hasJsonExtension = fileName.toLowerCase().endsWith('.json');
                const finalFileName = hasJsonExtension ? fileName : `${fileName}.json`;
                const fullPath = path.join(targetDir, finalFileName);

                // 根据 parsedFileContent 是否为空决定保存内容
                const contentToSave = parsedFileContent !== undefined && parsedFileContent !== null && parsedFileContent !== ''
                  ? JSON.stringify(parsedFileContent, null, 2)
                  : JSON.stringify(input, null, 2);
                fs.writeFileSync(fullPath, contentToSave, 'utf8');
                console.log('文件保存成功:', fullPath);

                // 保存成功，返回包含原始输入和文件信息的结果
                // 统一使用正斜杠格式输出路径
                result = {
                  ...input,
                  _file: {
                    success: true,
                    fileName: finalFileName,
                    fullPath: fullPath.replace(/\\/g, '/'),
                    savedAt: new Date().toISOString()
                  }
                };
              }
            } catch (err) {
              errorMessage = `节点 "${node.data?.label || nodeId}" 保存文件失败: ${err.message}`;
              console.log('保存文件错误:', err.message);
              nodeStatus = 'failed';
              nodeError = errorMessage;
            }
          }
          
          console.log('保存结果:', node.id, '=', result);
          results[node.id] = result;
          
          // 记录节点执行（所有类型节点都记录）
          nodeExecutions.push({
            nodeId: node.id,
            nodeName: node.data?.label || node.id,
            nodeType: node.type,
            status: nodeStatus,
            input: input,
            output: result,
            error: nodeError,
            requestInfo: nodeRequestInfo,
            startedAt: startedAt
          });
          
          // 如果出错，停止执行
          if (errorMessage) break
          
          // 将当前节点的下一个节点加入队列，并设置它们的输入
          const outgoingEdges = edges.filter(e => e.source === nodeId);
          console.log('当前节点的出边:', outgoingEdges.map(e => ({ target: e.target, sourceHandle: e.sourceHandle })));

          // 对于条件节点，两个条件各自独立判断是否执行对应分支
          if (node.type === 'condition' && result) {
            console.log('=== 条件分支处理 ===');
            // 条件1 -> yes
            if (result.cond1) {
              const edge1 = outgoingEdges.find(e => e.sourceHandle === 'yes');
              console.log('查找 yes 边:', edge1);
              if (edge1 && !visited.has(edge1.target)) {
                nodeInputMap[edge1.target] = input || result.originalInput || result.input || {};
                queue.push(edge1.target);
                console.log('条件1满足 -> 添加 yes 分支节点:', edge1.target);
              }
            }
            // 条件2 -> no
            if (result.cond2) {
              const edge2 = outgoingEdges.find(e => e.sourceHandle === 'no');
              console.log('查找 no 边:', edge2);
              if (edge2 && !visited.has(edge2.target)) {
                nodeInputMap[edge2.target] = input || result.originalInput || result.input || {};
                queue.push(edge2.target);
                console.log('条件2满足 -> 添加 no 分支节点:', edge2.target);
              }
            }
            // 如果两个条件都不满足，不继续执行任何分支
            if (!result.cond1 && !result.cond2) {
              console.log('两个条件都不满足，工作流结束');
            }
          } else {
            // 普通节点：所有出边都执行
            for (const edge of outgoingEdges) {
              if (!visited.has(edge.target)) {
                // 设置下一个节点的输入为当前节点的输出
                nodeInputMap[edge.target] = result || {};
                queue.push(edge.target);
              }
            }
          }
        }
      }
    } catch (err) {
      errorMessage = err.message;
      console.log('执行异常:', err.message);
    }
    
    // console.log('最终结果:', JSON.stringify(results));
    console.log('================');
    
    const finishedAt = new Date().toISOString();
    const status = errorMessage ? 'failed' : 'success';
    
    db.run(
      'UPDATE execution_logs SET status = ?, result = ?, error = ?, finishedAt = ? WHERE id = ?',
      [status, JSON.stringify(results), errorMessage, finishedAt, executionId]
    );
    
    // 保存节点执行记录
    for (const nodeExec of nodeExecutions) {
      const nodeExecId = uuidv4();
      db.run(
        'INSERT INTO node_executions (id, executionId, nodeId, nodeName, nodeType, status, input, output, error, requestInfo, startedAt, finishedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [nodeExecId, executionId, nodeExec.nodeId, nodeExec.nodeName, nodeExec.nodeType, nodeExec.status, JSON.stringify(nodeExec.input), nodeExec.output ? JSON.stringify(nodeExec.output) : null, nodeExec.error, nodeExec.requestInfo, nodeExec.startedAt, finishedAt]
      );
    }
    
    saveDatabase();
    
    res.json({
      id: executionId,
      workflowId,
      status,
      results,
      error: errorMessage,
      startedAt,
      finishedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 清理工作流的旧执行记录，只保留最新一条
router.delete('/:workflowId/prune', (req, res) => {
  try {
    const db = getDb();
    const { workflowId } = req.params;

    // 查找该工作流的所有执行记录，按 startedAt 降序排列
    const allLogs = [];
    const stmt = db.prepare('SELECT id FROM execution_logs WHERE workflowId = ? ORDER BY startedAt DESC');
    stmt.bind([workflowId]);
    while (stmt.step()) {
      allLogs.push(stmt.getAsObject());
    }
    stmt.free();

    if (allLogs.length <= 1) {
      return res.status(200).json({ message: '没有需要清理的记录' });
    }

    // 保留第一条（最新的），删除其余的
    const toKeep = allLogs[0].id;
    const toDelete = allLogs.slice(1).map(l => l.id);

    // 先删除关联的节点执行记录
    const placeholders = toDelete.map(() => '?').join(',');
    db.run(`DELETE FROM node_executions WHERE executionId IN (${placeholders})`, toDelete);
    // 删除执行日志
    db.run(`DELETE FROM execution_logs WHERE id IN (${placeholders})`, toDelete);

    saveDatabase();
    res.status(200).json({ message: `已删除 ${toDelete.length} 条记录，保留最新一条: ${toKeep}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;