import { useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'

export default function HttpNode({ id, data, selected, onDataChange, executionStatus }) {
  const method = data?.method || 'GET'
  const url = data?.url || ''
  const headers = data?.headers || '{}'
  const body = data?.body || ''

  // 执行状态样式
  const statusBgColor = {
    success: '#e8f5e9',
    failed: '#ffebee',
    running: '#e3f2fd',
  }[executionStatus?.status] || '#f3e5f5'

  const statusBorderColor = {
    success: '#4caf50',
    failed: '#f44336',
    running: '#2196f3',
  }[executionStatus?.status] || '#9c27b0'

  const statusIcon = {
    success: '✓',
    failed: '✗',
    running: '⟳',
  }[executionStatus?.status]

  const handleChange = useCallback((field, value) => {
    if (onDataChange && id) {
      onDataChange(id, { ...data, [field]: value })
    }
  }, [id, data, onDataChange])

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
      
      <div style={{ fontWeight: 'bold', color: '#7b1fa2', marginBottom: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>🌐</span>
        <span>HTTP 请求</span>
        {executionStatus?.status === 'failed' && (
          <span style={{ fontSize: '10px', color: '#f44336', fontWeight: 'normal' }}>
            - {executionStatus.error?.split(':')[0] || '失败'}
          </span>
        )}
      </div>
      
      {selected && (
        <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ minWidth: '40px' }}>方法:</label>
            <select 
              value={method} 
              onChange={(e) => handleChange('method', e.target.value)}
              style={{ flex: 1, padding: '2px' }}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ minWidth: '40px' }}>URL:</label>
            <input 
              type="text" 
              value={url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder="https://api.example.com"
              style={{ flex: 1, padding: '2px', fontSize: '11px' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ minWidth: '40px' }}>Headers:</label>
            <textarea 
              value={headers}
              onChange={(e) => handleChange('headers', e.target.value)}
              placeholder='{"Content-Type": "application/json"}'
              style={{ flex: 1, padding: '2px', fontSize: '11px', height: '40px', resize: 'none' }}
            />
          </div>
          
          {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ minWidth: '40px' }}>Body:</label>
              <textarea 
                value={body}
                onChange={(e) => handleChange('body', e.target.value)}
                placeholder='{"key": "value"}'
                style={{ flex: 1, padding: '2px', fontSize: '11px', height: '50px', resize: 'none' }}
              />
            </div>
          )}

          {/* 显示执行输出 */}
          {executionStatus?.output && (
            <div style={{ marginTop: '8px', padding: '6px', background: '#fff', borderRadius: '4px' }}>
              <div style={{ fontSize: '10px', color: '#4caf50', fontWeight: 'bold', marginBottom: '4px' }}>输出:</div>
              <pre style={{ 
                fontSize: '10px', 
                margin: 0,
                maxHeight: '80px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {typeof executionStatus.output === 'object' 
                  ? JSON.stringify(executionStatus.output, null, 2).substring(0, 200)
                  : String(executionStatus.output).substring(0, 200)
                }
              </pre>
            </div>
          )}
        </div>
      )}
      
      {!selected && (
        <div style={{ fontSize: '11px', color: '#666' }}>
          {method} {url || '未配置'}
        </div>
      )}
      
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
