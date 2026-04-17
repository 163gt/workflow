import { Handle, Position } from '@xyflow/react'

export default function EndNode({ data }) {
  return (
    <div style={{
      padding: '12px 20px',
      border: '2px solid #4caf50',
      borderRadius: '8px',
      background: '#e8f5e9',
      minWidth: '120px',
      textAlign: 'center'
    }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 'bold', color: '#2e7d32', fontSize: '14px' }}>{data.label || '结束'}</div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>🏁 终点</div>
    </div>
  )
}