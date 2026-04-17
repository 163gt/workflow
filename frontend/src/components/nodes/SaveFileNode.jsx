import { useCallback } from 'react'
import { Handle, Position } from '@xyflow/react'

// 科技风格样式（与 WorkflowEditor SilverNodeComponent 一致）
const nodeStyles = {
  default: {
    bg: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.12)',
    textColor: '#e0e0e0'
  },
  selected: {
    bg: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.3)',
    textColor: '#e0e0e0'
  },
  success: {
    bg: 'rgba(82, 196, 26, 0.1)',
    border: 'rgba(82, 196, 26, 0.5)',
    textColor: '#73d13d'
  },
  failed: {
    bg: 'rgba(255, 77, 79, 0.15)',
    border: 'rgba(255, 77, 79, 0.6)',
    textColor: '#ff7875'
  },
  running: {
    bg: 'rgba(100, 180, 255, 0.15)',
    border: 'rgba(100, 180, 255, 0.5)',
    textColor: '#8ec5fc'
  }
}

export default function SaveFileNode({ id, data, selected, onDataChange, executionStatus }) {
  // 获取样式
  const getStyles = () => {
    if (executionStatus?.status === 'success') return nodeStyles.success
    if (executionStatus?.status === 'failed') return nodeStyles.failed
    if (executionStatus?.status === 'running') return nodeStyles.running
    return selected ? nodeStyles.selected : nodeStyles.default
  }

  const { bg, border, textColor } = getStyles()
  const fileName = data?.fileName || ''
  const fileContent = data?.fileContent || ''
  const dirPath = data?.dirPath || ''

  const statusIcon = {
    success: '✓',
    failed: '✗',
    running: '⟳'
  }[executionStatus?.status]

  return (
    <div style={{
      padding: '14px 18px',
      background: bg,
      border: `2px solid ${border}`,
      borderRadius: '12px',
      minWidth: '180px',
      position: 'relative',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(10px)',
      boxShadow: selected ? `0 0 20px ${border}` : 'none'
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
          boxShadow: `0 0 10px ${border}`
        }}>
          {statusIcon}
        </div>
      )}

      <Handle type="target" position={Position.Left} style={{ background: 'rgba(255, 255, 255, 0.3)' }} />

      <div style={{
        fontWeight: '600',
        color: textColor,
        fontSize: '13px',
        letterSpacing: '1px',
        marginBottom: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        💾 保存文件
      </div>

      {/* 未选中时显示摘要信息 */}
      {!selected && (
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName ? `${fileName}.json` : '未设置文件名'}
        </div>
      )}

      {/* 选中时显示输入输出 */}
      {executionStatus && (executionStatus.input !== undefined || executionStatus.output !== undefined) && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {executionStatus.input !== undefined && executionStatus.input !== null && (
            <div style={{ padding: '4px 6px', background: 'rgba(100, 180, 255, 0.1)', borderRadius: '4px', fontSize: '10px' }}>
              <span style={{ color: '#8ec5fc' }}>IN:</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', marginLeft: '4px' }}>
                {typeof executionStatus.input === 'object' ? JSON.stringify(executionStatus.input).substring(0, 30) : String(executionStatus.input).substring(0, 30)}...
              </span>
            </div>
          )}
          {executionStatus.output !== undefined && executionStatus.output !== null && (
            <div style={{ padding: '4px 6px', background: 'rgba(82, 196, 26, 0.1)', borderRadius: '4px', fontSize: '10px' }}>
              <span style={{ color: '#73d13d' }}>OUT:</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', marginLeft: '4px' }}>
                {typeof executionStatus.output === 'object' ? JSON.stringify(executionStatus.output).substring(0, 30) : String(executionStatus.output).substring(0, 30)}...
              </span>
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: 'rgba(255, 255, 255, 0.3)' }} />
    </div>
  )
}

// 配置面板组件
export const SaveFileNodePanel = ({ node, data, handleChange, t, executionStatus }) => {
  const lang = localStorage.getItem('lang') || 'zh'

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#8ec5fc',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '10px',
    fontSize: '11px',
    letterSpacing: '2px',
    color: 'rgba(255, 255, 255, 0.5)'
  }

  // 获取上一个节点的输出
  const getPrevOutput = () => executionStatus?.input || null

  // 填充字段到 input
  const fillFromInput = (field) => {
    const prev = getPrevOutput()
    if (prev !== null) {
      if (typeof prev === 'object') {
        handleChange(field, JSON.stringify(prev, null, 2))
      } else {
        handleChange(field, String(prev))
      }
    }
  }

  const prevOutput = getPrevOutput()

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <label style={labelStyle}>FILE NAME</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={data.fileName || ''}
            onChange={(e) => handleChange('fileName', e.target.value)}
            placeholder={lang === 'zh' ? '例如: result, data' : 'e.g: result, data'}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={(e) => e.target.style.border = 'rgba(100, 180, 255, 0.3)'}
            onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
          />
          {/* {prevOutput !== null && (
            <button
              type="button"
              onClick={() => fillFromInput('fileName')}
              style={{
                padding: '12px 16px',
                background: 'rgba(100, 180, 255, 0.1)',
                border: '1px solid rgba(100, 180, 255, 0.3)',
                borderRadius: '8px',
                color: '#8ec5fc',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap'
              }}
              title={lang === 'zh' ? '使用上一个节点输出填充' : 'Fill from previous output'}
            >
              📥
            </button>
          )} */}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={labelStyle}>DIRECTORY ({lang === 'zh' ? '可选' : 'Optional'})</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={data.dirPath || ''}
            onChange={(e) => handleChange('dirPath', e.target.value)}
            placeholder={lang === 'zh' ? './outputs' : './outputs'}
            style={{ ...inputStyle, flex: 1 }}
            onFocus={(e) => e.target.style.border = 'rgba(100, 180, 255, 0.3)'}
            onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
          />
          {/* {prevOutput !== null && (
            <button
              type="button"
              onClick={() => fillFromInput('dirPath')}
              style={{
                padding: '12px 16px',
                background: 'rgba(100, 180, 255, 0.1)',
                border: '1px solid rgba(100, 180, 255, 0.3)',
                borderRadius: '8px',
                color: '#8ec5fc',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap'
              }}
            >
              📥
            </button>
          )} */}
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)' }}>
          {lang === 'zh' ? '留空则保存在项目 outputs 目录' : 'Leave empty to save in project outputs directory'}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={labelStyle}>FILE CONTENT ({lang === 'zh' ? '可选' : 'Optional'})</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={data.fileContent || ''}
            onChange={(e) => handleChange('fileContent', e.target.value)}
            placeholder={lang === 'zh' ? '输入要保存的内容...' : 'Content to save...'}
            style={{ ...inputStyle, fontFamily: 'monospace', minHeight: '120px', resize: 'vertical', flex: 1 }}
            onFocus={(e) => e.target.style.border = 'rgba(100, 180, 255, 0.3)'}
            onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
          />
          {/* {prevOutput !== null && (
            <button
              type="button"
              onClick={() => fillFromInput('fileContent')}
              style={{
                padding: '12px 16px',
                background: 'rgba(100, 180, 255, 0.1)',
                border: '1px solid rgba(100, 180, 255, 0.3)',
                borderRadius: '8px',
                color: '#8ec5fc',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                alignSelf: 'flex-start'
              }}
            >
              📥
            </button>
          )} */}
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.3)' }}>
          {lang === 'zh' ? '留空则自动保存上一个节点的输出为 JSON' : 'Leave empty to auto-save previous node output as JSON'}
        </div>
      </div>
    </>
  )
}