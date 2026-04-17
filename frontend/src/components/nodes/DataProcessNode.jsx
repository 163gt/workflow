import { useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'

export default function DataProcessNode({ id, data, selected, onDataChange, executionStatus }) {
  const code = data?.code || '// 在这里编写处理逻辑\nconst result = input;\nreturn result;'
  const output = data?.output || ''

  // 执行状态样式
  const statusBgColor = {
    success: '#fff8e1',
    failed: '#ffebee',
    running: '#e3f2fd',
  }[executionStatus?.status] || '#fff3e0'

  const statusBorderColor = {
    success: '#ffc107',
    failed: '#f44336',
    running: '#2196f3',
  }[executionStatus?.status] || '#ff9800'

  const statusIcon = {
    success: '✓',
    failed: '✗',
    running: '⟳',
  }[executionStatus?.status]

  const handleChange = useCallback((value) => {
    if (onDataChange && id) {
      onDataChange(id, { ...data, code: value })
    }
  }, [id, data, onDataChange])

  const runCode = useCallback(() => {
    try {
      const input = data?.input || { test: '数据' }
      const fn = new Function('input', code)
      const result = fn(input)
      if (onDataChange && id) {
        onDataChange(id, { ...data, code, output: result })
      }
    } catch (error) {
      if (onDataChange && id) {
        onDataChange(id, { ...data, code, output: `错误: ${error.message}` })
      }
    }
  }, [id, data, code, onDataChange])

  return (
    <div style={{
      padding: '12px',
      border: selected ? `2px solid ${statusBorderColor}` : `2px solid ${statusBorderColor}`,
      borderRadius: '8px',
      background: statusBgColor,
      minWidth: '220px',
      position: 'relative'
    }}>
      {/* 执行状态指示器 */}
      {executionStatus && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: statusBorderColor,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          {statusIcon}
        </div>
      )}
      
      <Handle type="target" position={Position.Left} />
      
      <div style={{ fontWeight: 'bold', color: '#e65100', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>⚙️</span>
        <span>数据处理</span>
        {executionStatus?.status === 'failed' && (
          <span style={{ fontSize: '10px', color: '#f44336', fontWeight: 'normal' }}>
            - {executionStatus.error?.split(':')[0] || '失败'}
          </span>
        )}
      </div>
      
      {selected && (
        <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label>脚本代码:</label>
            <button 
              onClick={runCode}
              style={{ 
                padding: '2px 8px', 
                background: '#ff9800', 
                color: 'white', 
                border: 'none', 
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              执行
            </button>
          </div>
          
          <textarea 
            value={code}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="// 输入处理逻辑"
            style={{ 
              width: '100%', 
              padding: '4px', 
              fontSize: '11px', 
              fontFamily: 'monospace',
              height: '80px', 
              resize: 'none',
              background: '#1e1e1e',
              color: '#d4d4d4',
              borderRadius: '4px'
            }}
          />

          {/* 显示执行详情 */}
          {executionStatus?.input && Object.keys(executionStatus.input).length > 0 && (
            <div style={{ marginTop: '4px', padding: '4px', background: '#e3f2fd', borderRadius: '4px' }}>
              <div style={{ fontSize: '10px', color: '#1976d2', fontWeight: 'bold' }}>输入:</div>
              <pre style={{ 
                fontSize: '10px', 
                margin: 0,
                maxHeight: '50px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {JSON.stringify(executionStatus.input).substring(0, 100)}...
              </pre>
            </div>
          )}
          
          {output && (
            <div style={{ marginTop: '4px' }}>
              <label>输出结果:</label>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '4px', 
                fontSize: '10px', 
                maxHeight: '60px', 
                overflow: 'auto',
                marginTop: '2px'
              }}>
                {typeof output === 'object' ? JSON.stringify(output, null, 2) : output}
              </pre>
            </div>
          )}

          {/* 显示执行输出 */}
          {executionStatus?.output && (
            <div style={{ marginTop: '4px', padding: '4px', background: '#e8f5e9', borderRadius: '4px' }}>
              <div style={{ fontSize: '10px', color: '#388e3c', fontWeight: 'bold' }}>输出:</div>
              <pre style={{ 
                fontSize: '10px', 
                margin: 0,
                maxHeight: '60px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {typeof executionStatus.output === 'object' 
                  ? JSON.stringify(executionStatus.output).substring(0, 150)
                  : String(executionStatus.output).substring(0, 150)
                }
              </pre>
            </div>
          )}
        </div>
      )}
      
      {!selected && (
        <div style={{ fontSize: '11px', color: '#666', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {code.split('\n')[0] || '数据处理节点'}
        </div>
      )}
      
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
