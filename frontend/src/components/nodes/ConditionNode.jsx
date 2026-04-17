import { Handle, Position } from '@xyflow/react'

export default function ConditionNode({ id, data, selected, executionStatus, lang = 'zh', colors = {} }) {
  // 执行状态样式 - 与其他节点保持一致
  const isSuccess = executionStatus?.status === 'success'
  const isFailed = executionStatus?.status === 'failed'
  const isRunning = executionStatus?.status === 'running'

  let bg, border, textColor
  if (isFailed) {
    bg = 'rgba(255, 77, 79, 0.15)'
    border = 'rgba(255, 77, 79, 0.6)'
    textColor = '#ff7875'
  } else if (isSuccess) {
    bg = selected ? 'rgba(82, 196, 26, 0.2)' : 'rgba(82, 196, 26, 0.1)'
    border = 'rgba(82, 196, 26, 0.5)'
    textColor = '#73d13d'
  } else if (isRunning) {
    bg = 'rgba(100, 180, 255, 0.15)'
    border = 'rgba(100, 180, 255, 0.5)'
    textColor = '#8ec5fc'
  } else {
    bg = selected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)'
    border = selected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.12)'
    textColor = '#e0e0e0'
  }

  const statusIcon = isSuccess ? '✓' : isFailed ? '✗' : isRunning ? '⟳' : null

  // conditions 数组固定两个元素，分别对应两个输出 Handle
  const conditions = data?.conditions || [null, null]
  const condition1 = conditions[0]
  const condition2 = conditions[1]

  return (
    <div style={{
      background: bg,
      border: `2px solid ${border}`,
      borderRadius: '12px',
      minWidth: '180px',
      position: 'relative',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(10px)',
      boxShadow: selected ? `0 0 20px ${border}` : 'none',
      overflow: 'visible'
    }}>
      {/* 执行状态指示器 */}
      {statusIcon && (
        <div style={{
          position: 'absolute',
          top: '-12px',
          right: '-12px',
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: border,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          boxShadow: `0 0 10px ${border}`,
          zIndex: 10
        }}>
          {statusIcon}
        </div>
      )}

      {/* 左侧输入 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: 'rgba(255, 255, 255, 0.3)', left: '-6px' }}
      />

      {/* 顶部左侧输出 Handle - 条件1 */}
      <div style={{ position: 'absolute', top: '-6px', left: '25%', transform: 'translateX(-50%)' }}>
        <Handle
          type="source"
          position={Position.Top}
          id="yes"
          style={{
            background: 'rgba(255, 255, 255, 0.3)',
          }}
        />
        <div style={{
          position: 'absolute',
          top: '5px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          color: '#52c41a',
          whiteSpace: 'nowrap'
        }}>
          {lang === 'zh' ? '条件1' : 'Cond 1'}
        </div>
      </div>

      {/* 顶部右侧输出 Handle - 条件2 */}
      <div style={{ position: 'absolute', top: '-6px', left: '75%', transform: 'translateX(-50%)' }}>
        <Handle
          type="source"
          position={Position.Top}
          id="no"
          style={{
            background: 'rgba(255, 255, 255, 0.3)',
          }}
        />
        <div style={{
          position: 'absolute',
          top: '5px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          color: '#1890ff',
          whiteSpace: 'nowrap'
        }}>
          {lang === 'zh' ? '条件2' : 'Cond 2'}
        </div>
      </div>

      {/* 标题 */}
      <div style={{
        padding: '14px 18px 10px 16px',
        fontWeight: '600',
        color: textColor,
        fontSize: '13px',
        letterSpacing: '1px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        ⚡ {lang === 'zh' ? '条件判断' : 'Condition'}
      </div>

      {/* 两个条件显示 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px'
      }}>
        {/* 条件1 */}
        <div
          style={{
            background: 'rgba(82, 196, 26, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(82, 196, 26, 0.25)',
            padding: '8px 10px'
          }}
        >
          <div style={{ fontSize: '10px', color: '#52c41a', fontWeight: '500', marginBottom: '3px' }}>
            {lang === 'zh' ? '条件1' : 'Condition 1'}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', wordBreak: 'break-all' }}>
            {condition1?.expression || (lang === 'zh' ? '点击编辑' : 'Click to edit')}
          </div>
        </div>

        {/* 条件2 */}
        <div
          style={{
            background: 'rgba(24, 144, 255, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(24, 144, 255, 0.25)',
            padding: '8px 10px'
          }}
        >
          <div style={{ fontSize: '10px', color: '#1890ff', fontWeight: '500', marginBottom: '3px' }}>
            {lang === 'zh' ? '条件2' : 'Condition 2'}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', wordBreak: 'break-all' }}>
            {condition2?.expression || (lang === 'zh' ? '点击编辑' : 'Click to edit')}
          </div>
        </div>
      </div>
    </div>
  )
}