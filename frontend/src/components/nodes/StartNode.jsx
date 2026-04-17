import { Handle, Position } from '@xyflow/react'

export default function StartNode({ data }) {
  return (
    <div style={{
      padding: '12px 20px',
      border: '2px solid #4a90d9',
      borderRadius: '8px',
      background: '#e3f2fd',
      minWidth: '120px',
      textAlign: 'center'
    }}>
      <Handle type="source" position={Position.Right} />
      <div style={{ fontWeight: 'bold', color: '#1565c0', fontSize: '14px' }}>{data.label || '开始'}</div>
      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>🚀 起点</div>
    </div>
  )
}