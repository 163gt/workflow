const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../db');

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function resolvePathValue(source, path) {
  if (!path) return source;
  return path.split('.').reduce((obj, key) => obj?.[key], source);
}

function resolveTemplate(template, context) {
  if (template === null || template === undefined) return template;
  if (typeof template !== 'string') return template;

  return template.replace(/\{\{\s*(input|params)\.([^}]+)\s*\}\}|\$\{\s*(input|params)\.([^}]+)\s*\}/g, (match, scopeA, pathA, scopeB, pathB) => {
    const scope = scopeA || scopeB;
    const path = pathA || pathB;
    const value = resolvePathValue(context[scope], path?.trim());
    return value === undefined ? match : String(value);
  });
}

function parseWorkflowRow(row) {
  return {
    ...row,
    nodes: safeJsonParse(row.nodes, []),
    edges: safeJsonParse(row.edges, []),
    paramsSchema: safeJsonParse(row.paramsSchema, [])
  };
}

async function executeWorkflowById(workflowId, options = {}) {
  const db = getDb();
  const {
    params = {},
    paramSetId = null,
    batchJobId = null,
    batchItemId = null
  } = options;

  const wfStmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
  wfStmt.bind([workflowId]);

  if (!wfStmt.step()) {
    wfStmt.free();
    const error = new Error('工作流不存在');
    error.statusCode = 404;
    throw error;
  }

  const workflow = parseWorkflowRow(wfStmt.getAsObject());
  wfStmt.free();

  const nodes = workflow.nodes;
  const edges = workflow.edges;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const executionId = uuidv4();
  const startedAt = new Date().toISOString();

  db.run(
    `INSERT INTO execution_logs
      (id, workflowId, paramSetId, batchJobId, batchItemId, status, result, error, paramsSnapshot, startedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [executionId, workflowId, paramSetId, batchJobId, batchItemId, 'running', null, null, JSON.stringify(params || {}), startedAt]
  );

  const results = {};
  const nodeExecutions = [];
  let errorMessage = null;

  try {
    const startNode = nodes.find((node) => node.type === 'start');
    if (!startNode) {
      errorMessage = '工作流缺少开始节点';
    } else {
      const queue = [{ nodeId: startNode.id, input: {}, fromNodeId: null, viaEdgeId: null, sourceHandle: null }];
      const maxTaskCount = Math.max(nodes.length * Math.max(edges.length, 1) * 10, 1000);
      const incomingEdgesByTarget = edges.reduce((map, edge) => {
        if (!map.has(edge.target)) map.set(edge.target, []);
        map.get(edge.target).push(edge);
        return map;
      }, new Map());
      const dataProcessAggregateState = new Map();
      let processedTaskCount = 0;

      while (queue.length > 0) {
        const currentTask = queue.shift();
        let input = currentTask.input ?? {};
        const { nodeId, fromNodeId = null, viaEdgeId = null, sourceHandle = null } = currentTask;

        processedTaskCount += 1;
        if (processedTaskCount > maxTaskCount) {
          errorMessage = '执行任务数超过安全限制';
          break;
        }

        const node = nodeMap.get(nodeId);
        if (!node) continue;

        const incomingEdges = incomingEdgesByTarget.get(nodeId) || [];
        if (node.type === 'dataProcess' && incomingEdges.length > 1) {
          const aggregateState = dataProcessAggregateState.get(nodeId) || {
            receivedByEdgeId: new Map()
          };

          if (viaEdgeId) {
            aggregateState.receivedByEdgeId.set(viaEdgeId, {
              edgeId: viaEdgeId,
              sourceNodeId: fromNodeId,
              sourceHandle,
              value: input
            });
          }

          dataProcessAggregateState.set(nodeId, aggregateState);

          if (aggregateState.receivedByEdgeId.size < incomingEdges.length) {
            continue;
          }

          input = {
            values: incomingEdges
              .map((edge) => aggregateState.receivedByEdgeId.get(edge.id))
              .filter(Boolean)
              .map((entry) => entry.value)
          };

          dataProcessAggregateState.delete(nodeId);
        }

        const context = { input, params };
        let result = null;
        let nodeStatus = 'success';
        let nodeError = null;
        let nodeRequestInfo = null;

        if (node.type === 'http') {
          const { method = 'GET', url, headers, body } = node.data || {};
          const resolvedUrl = resolveTemplate(url, context);
          const unresolvedTemplates = resolvedUrl?.match(/\{\{\s*(input|params)\.[^}]+\s*\}\}|\$\{\s*(input|params)\.[^}]+\s*\}/g) || [];

          if (unresolvedTemplates.length > 0) {
            errorMessage = `节点 "${node.data?.label || nodeId}" 的 URL 包含未解析变量: ${unresolvedTemplates.join(', ')}`;
            nodeStatus = 'failed';
            nodeError = errorMessage;
          } else if (!resolvedUrl || !resolvedUrl.trim()) {
            errorMessage = `节点 "${node.data?.label || nodeId}" 的 URL 不能为空`;
            nodeStatus = 'failed';
            nodeError = errorMessage;
          } else {
            try {
              const resolvedHeaders = resolveTemplate(headers, context);
              let headerObj = {};
              if (typeof resolvedHeaders === 'object' && resolvedHeaders !== null) {
                headerObj = resolvedHeaders;
              } else if (typeof resolvedHeaders === 'string' && resolvedHeaders.trim()) {
                headerObj = JSON.parse(resolvedHeaders);
              }

              const resolvedBody = resolveTemplate(body, context);
              let bodyContent = null;
              if (typeof resolvedBody === 'object' && resolvedBody !== null) {
                bodyContent = JSON.stringify(resolvedBody);
              } else if (typeof resolvedBody === 'string') {
                bodyContent = resolvedBody;
              }

              const response = await fetch(resolvedUrl.trim(), {
                method,
                headers: headerObj,
                body: bodyContent && ['POST', 'PUT', 'PATCH'].includes(method) ? bodyContent : undefined,
                signal: AbortSignal.timeout(480000)
              });

              const text = await response.text();

              const curlParts = [`curl -X ${method}`];
              Object.entries(headerObj).forEach(([key, value]) => {
                curlParts.push(`-H '${key}: ${value}'`);
              });
              if (bodyContent) {
                curlParts.push(`-d '${bodyContent}'`);
              }
              curlParts.push(`'${resolvedUrl.trim()}'`);
              nodeRequestInfo = curlParts.join(' ');

              result = {
                status: response.status,
                statusText: response.statusText,
                body: text,
                _raw: {
                  url: resolvedUrl.trim(),
                  headers: headerObj,
                  body: bodyContent
                }
              };
            } catch (err) {
              errorMessage = `节点 "${node.data?.label || nodeId}" HTTP请求失败: ${err.message}`;
              nodeStatus = 'failed';
              nodeError = errorMessage;
            }
          }
        } else if (node.type === 'dataProcess') {
          try {
            const fn = new Function('input', 'params', node.data?.code || 'return input');
            result = fn(input, params);
          } catch (err) {
            errorMessage = `节点 "${node.data?.label || nodeId}" 脚本执行失败: ${err.message}`;
            nodeStatus = 'failed';
            nodeError = errorMessage;
          }
        } else if (node.type === 'condition') {
          const conditions = node.data?.conditions || [null, null];
          const evaluateCondition = (condition, rawInput) => {
            if (!condition?.expression) return null;
            let expression = condition.expression.trim();
            if (expression.endsWith(';')) expression = expression.slice(0, -1);
            try {
              const fn = new Function('input', 'params', `return !!(${expression})`);
              return fn(rawInput, params);
            } catch {
              return false;
            }
          };

          result = {
            cond1: evaluateCondition(conditions[0], input),
            cond2: evaluateCondition(conditions[1], input),
            input,
            originalInput: input
          };
        } else if (node.type === 'saveFile') {
          try {
            const fs = require('fs');
            const path = require('path');

            let { fileName, dirPath, fileContent } = node.data || {};
            fileName = resolveTemplate(fileName, context);
            dirPath = resolveTemplate(dirPath, context);
            if (dirPath) dirPath = dirPath.replace(/\\/g, '/');

            let parsedFileContent = fileContent;
            if (typeof fileContent === 'string') {
              const inputMatch = fileContent.match(/\{\{\s*(input|params)(?:\.([^}]+))?\s*\}\}|\$\{\s*(input|params)(?:\.([^}]+))?\s*\}/);
              if (inputMatch) {
                const scope = inputMatch[1] || inputMatch[3];
                const pathValue = inputMatch[2] || inputMatch[4] || '';
                const source = scope === 'params' ? params : input;
                const value = resolvePathValue(source, pathValue);
                parsedFileContent = typeof value === 'object' ? value : resolveTemplate(fileContent, context);
              } else {
                parsedFileContent = resolveTemplate(fileContent, context);
              }
            }

            if (!fileName) {
              errorMessage = `节点 "${node.data?.label || nodeId}" 文件名不能为空`;
              nodeStatus = 'failed';
              nodeError = errorMessage;
            } else {
              const targetDir = dirPath || path.join(process.cwd(), 'outputs');
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
              }

              const finalFileName = fileName.toLowerCase().endsWith('.json') ? fileName : `${fileName}.json`;
              const fullPath = path.join(targetDir, finalFileName);
              const contentToSave = parsedFileContent !== undefined && parsedFileContent !== null && parsedFileContent !== ''
                ? JSON.stringify(parsedFileContent, null, 2)
                : JSON.stringify(input, null, 2);

              fs.writeFileSync(fullPath, contentToSave, 'utf8');
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
            nodeStatus = 'failed';
            nodeError = errorMessage;
          }
        } else {
          result = input;
        }

        results[node.id] = result;
        nodeExecutions.push({
          nodeId: node.id,
          nodeName: node.data?.label || node.id,
          nodeType: node.type,
          status: nodeStatus,
          input,
          output: result,
          error: nodeError,
          requestInfo: nodeRequestInfo,
          startedAt
        });

        if (errorMessage) break;

        const outgoingEdges = edges.filter((edge) => edge.source === nodeId);
        if (node.type === 'condition' && result) {
          if (result.cond1) {
            outgoingEdges
              .filter((edge) => edge.sourceHandle === 'yes')
              .forEach((edge) => {
                queue.push({
                  nodeId: edge.target,
                  input: input || result.originalInput || result.input || {},
                  fromNodeId: nodeId,
                  viaEdgeId: edge.id,
                  sourceHandle: edge.sourceHandle || null
                });
              });
          }

          if (result.cond2) {
            outgoingEdges
              .filter((edge) => edge.sourceHandle === 'no')
              .forEach((edge) => {
                queue.push({
                  nodeId: edge.target,
                  input: input || result.originalInput || result.input || {},
                  fromNodeId: nodeId,
                  viaEdgeId: edge.id,
                  sourceHandle: edge.sourceHandle || null
                });
              });
          }
        } else {
          outgoingEdges.forEach((edge) => {
            queue.push({
              nodeId: edge.target,
              input: result || {},
              fromNodeId: nodeId,
              viaEdgeId: edge.id,
              sourceHandle: edge.sourceHandle || null
            });
          });
        }
      }
    }
  } catch (err) {
    errorMessage = err.message;
  }

  const finishedAt = new Date().toISOString();
  const status = errorMessage ? 'failed' : 'success';

  db.run(
    `UPDATE execution_logs
     SET status = ?, result = ?, error = ?, finishedAt = ?
     WHERE id = ?`,
    [status, JSON.stringify(results), errorMessage, finishedAt, executionId]
  );

  nodeExecutions.forEach((nodeExec) => {
    db.run(
      `INSERT INTO node_executions
        (id, executionId, nodeId, nodeName, nodeType, status, input, output, error, requestInfo, startedAt, finishedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        executionId,
        nodeExec.nodeId,
        nodeExec.nodeName,
        nodeExec.nodeType,
        nodeExec.status,
        JSON.stringify(nodeExec.input),
        nodeExec.output ? JSON.stringify(nodeExec.output) : null,
        nodeExec.error,
        nodeExec.requestInfo,
        nodeExec.startedAt,
        finishedAt
      ]
    );
  });

  saveDatabase();

  return {
    id: executionId,
    workflowId,
    paramSetId,
    batchJobId,
    batchItemId,
    status,
    params,
    results,
    error: errorMessage,
    startedAt,
    finishedAt
  };
}

module.exports = {
  executeWorkflowById,
  parseWorkflowRow,
  safeJsonParse
};
