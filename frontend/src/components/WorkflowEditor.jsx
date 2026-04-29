import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from './Toast'
import { useLanguage } from '../i18n'
import HttpNode from './nodes/HttpNode'
import DataProcessNode from './nodes/DataProcessNode'
import ConditionNode from './nodes/ConditionNode'
import SaveFileNode, { SaveFileNodePanel } from './nodes/SaveFileNode'
import { useNodeTemplates } from '../hooks/useNodeTemplates'
import {
  Button,
  Typography,
  Space,
  Tooltip,
  Spin,
  Modal,
  Input
} from '@douyinfe/semi-ui'
import {
  IconPlus,
  IconSave,
  IconPlay,
  IconChevronLeft,
  IconHelpCircle,
  IconDelete
} from '@douyinfe/semi-icons'

const { Text } = Typography

// 翻译 hook
const colors = {
  bgPrimary: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
  bgSecondary: 'linear-gradient(135deg, rgba(25, 25, 45, 0.9) 0%, rgba(15, 15, 30, 0.95) 100%)',
  bgCard: 'linear-gradient(135deg, rgba(30, 30, 50, 0.6) 0%, rgba(20, 20, 35, 0.8) 100%)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(100, 180, 255, 0.3)',
  text: '#e0e0e0',
  textSecondary: 'rgba(255, 255, 255, 0.5)',
  textMuted: 'rgba(255, 255, 255, 0.3)',
  accent: '#64b5f6',
  accentGlow: 'rgba(100, 180, 255, 0.3)',
  success: '#52c41a',
  error: '#ff4d4f',
  warning: '#faad14',
  nodeSilver: 'linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 50%, #e8e8e8 100%)',
  nodeGlow: 'rgba(255, 255, 255, 0.15)'
}

// ==================== 加载动画组件 ====================
function LoadingSpinner() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '24px'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '2px solid rgba(100, 180, 255, 0.2)',
        borderTop: '2px solid #64b5f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span style={{
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '13px',
        letterSpacing: '3px',
        textTransform: 'uppercase'
      }}>
        LOADING
      </span>
    </div>
  )
}

// ==================== 错误显示组件 ====================
function ErrorDisplay({ message, onRetry }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '24px',
      padding: '40px'
    }}>
      <div style={{
        color: '#ff4d4f',
        fontSize: '14px',
        textAlign: 'center',
        letterSpacing: '1px',
        padding: '20px',
        background: 'rgba(255, 77, 79, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 77, 79, 0.3)'
      }}>
        {message}
      </div>
      <span
        onClick={onRetry}
        style={{
          padding: '12px 32px',
          background: 'linear-gradient(135deg, rgba(100, 180, 255, 0.2) 0%, rgba(100, 180, 255, 0.1) 100%)',
          border: '1px solid rgba(100, 180, 255, 0.4)',
          borderRadius: '8px',
          color: '#64b5f6',
          fontSize: '13px',
          letterSpacing: '2px',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
      >
        RETRY
      </span>
    </div>
  )
}

// ==================== 右侧属性编辑面板 ====================
function PropertyPanel({ node, onClose, onUpdate, onSaveAsTemplate, executionStatus }) {
  const { t, lang } = useLanguage()
  const [data, setData] = useState({ ...node.data })

  useEffect(() => {
    setData({ ...node.data })
  }, [node.id])

  const handleChange = (field, value) => {
    const newData = { ...data, [field]: value }
    setData(newData)
    onUpdate(node.id, newData)
  }

  const getNodeTypeName = () => {
    switch (node.type) {
      case 'http': return t('http request')
      case 'dataProcess': return t('data process')
      case 'condition': return t('condition')
      case 'start': return t('start node')
      case 'end': return t('end node')
      case 'saveFile': return t('save file')
      default: return 'NODE'
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box'
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '380px',
      height: '100%',
      background: colors.bgSecondary,
      borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      backdropFilter: 'blur(20px)'
    }}>
      {/* 头部 */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(30, 30, 50, 0.8) 0%, transparent 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: colors.accent,
            boxShadow: `0 0 10px ${colors.accentGlow}`
          }} />
          <span style={{
            fontWeight: '500',
            fontSize: '13px',
            letterSpacing: '2px',
            color: colors.text
          }}>
            {getNodeTypeName()}
          </span>
        </div>
        <span
          onClick={onClose}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            color: 'rgba(255, 255, 255, 0.4)',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.color = '#fff'}
          onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.4)'}
        >
          ×
        </span>
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {/* 节点名称 */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontSize: '11px',
            letterSpacing: '2px',
            color: colors.textSecondary
          }}>
            NAME
          </label>
          <input
            type="text"
            value={data.label || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            style={inputStyle}
            onFocus={(e) => e.target.style.border = colors.borderHover}
            onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
          />
        </div>

        {/* HTTP 节点配置 */}
        {node.type === 'http' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontSize: '11px',
                letterSpacing: '2px',
                color: colors.textSecondary
              }}>
                METHOD
              </label>
              <select
                value={data.method || 'GET'}
                onChange={(e) => handleChange('method', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={(e) => e.target.style.border = colors.borderHover}
                onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
              >
                <option value="GET" style={{ background: '#1a1a2e' }}>GET</option>
                <option value="POST" style={{ background: '#1a1a2e' }}>POST</option>
                <option value="PUT" style={{ background: '#1a1a2e' }}>PUT</option>
                <option value="DELETE" style={{ background: '#1a1a2e' }}>DELETE</option>
                <option value="PATCH" style={{ background: '#1a1a2e' }}>PATCH</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontSize: '11px',
                letterSpacing: '2px',
                color: colors.textSecondary
              }}>
                URL
              </label>
              <input
                type="text"
                value={data.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://api.example.com/data"
                style={inputStyle}
                onFocus={(e) => e.target.style.border = colors.borderHover}
                onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontSize: '11px',
                letterSpacing: '2px',
                color: colors.textSecondary
              }}>
                HEADERS
              </label>
              <textarea
                value={data.headers || '{}'}
                onChange={(e) => handleChange('headers', e.target.value)}
                placeholder='{"Content-Type": "application/json"}'
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                onFocus={(e) => e.target.style.border = colors.borderHover}
                onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
              />
            </div>

            {['POST', 'PUT', 'PATCH'].includes(data.method) && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontSize: '11px',
                  letterSpacing: '2px',
                  color: colors.textSecondary
                }}>
                  BODY
                </label>
                <textarea
                  value={data.body || ''}
                  onChange={(e) => handleChange('body', e.target.value)}
                  placeholder='{"key": "value"}'
                  style={{
                    ...inputStyle,
                    fontFamily: 'monospace',
                    minHeight: '100px',
                    resize: 'vertical'
                  }}
                  onFocus={(e) => e.target.style.border = colors.borderHover}
                  onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
                />
              </div>
            )}
          </>
        )}

        {/* 数据处理节点配置 */}
        {node.type === 'dataProcess' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontSize: '11px',
                letterSpacing: '2px',
                color: colors.textSecondary
              }}>
                SCRIPT
              </label>
              <textarea
                value={data.code || ''}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder={t('write your logic') + '\n' + t('result variable') + '\n' + t('return result')}
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  minHeight: '200px',
                  resize: 'vertical',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#8ec5fc'
                }}
                onFocus={(e) => e.target.style.border = colors.borderHover}
                onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
              />
              <div style={{
                marginTop: '12px',
                padding: '14px',
                background: 'rgba(100, 180, 255, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(100, 180, 255, 0.15)',
                fontSize: '12px',
                lineHeight: 1.8
              }}>
                <div style={{ color: colors.accent, fontWeight: '500', marginBottom: '6px', letterSpacing: '1px' }}>
                  {t('hint').toUpperCase()}
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', color: colors.textSecondary }}>
                  <li><code style={{ color: '#8ec5fc' }}>input</code> - {t('input hint')}</li>
                  <li><code style={{ color: '#8ec5fc' }}>return</code> - {t('return hint')}</li>
                </ul>
              </div>
            </div>

            {data.output && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontSize: '11px',
                  letterSpacing: '2px',
                  color: colors.textSecondary
                }}>
                  {t('last result').toUpperCase()}
                </label>
                <pre style={{
                  margin: 0,
                  padding: '14px',
                  background: 'rgba(82, 196, 26, 0.1)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  maxHeight: '150px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: '#73d13d',
                  border: '1px solid rgba(82, 196, 26, 0.2)'
                }}>
                  {typeof data.output === 'object' ? JSON.stringify(data.output, null, 2) : data.output}
                </pre>
              </div>
            )}
          </>
        )}

        {/* 开始/结束节点 */}
        {(node.type === 'start' || node.type === 'end') && (
          <div style={{
            padding: '24px',
            background: colors.bgCard,
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '13px',
              color: colors.textSecondary,
              lineHeight: 1.8
            }}>
              {node.type === 'start' ? t('start node desc') : t('end node desc')}
            </div>
          </div>
        )}

        {/* 条件分支节点 */}
        {node.type === 'condition' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                padding: '14px',
                background: 'rgba(233, 30, 99, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(233, 30, 99, 0.2)',
                marginBottom: '20px'
              }}>
                <div style={{ color: '#e91e63', fontSize: '12px', fontWeight: '500', marginBottom: '8px', letterSpacing: '1px' }}>
                  {t('condition').toUpperCase()}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: '11px', lineHeight: 1.6 }}>
                  {lang === 'zh' ? '两个条件独立判断，满足则对应输出点输出数据' : 'Each condition is evaluated independently. If satisfied, data outputs from the corresponding handle.'}
                </div>
              </div>
            </div>

            {/* 固定两个条件输入框 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '12px',
                fontSize: '11px',
                letterSpacing: '2px',
                color: colors.textSecondary
              }}>
                {lang === 'zh' ? '条 件' : 'CONDITIONS'}
              </label>

              {/* 条件1 */}
              <div style={{
                marginBottom: '12px',
                padding: '14px',
                background: colors.bgCard,
                borderRadius: '8px',
                border: '1px solid rgba(82, 196, 26, 0.3)'
              }}>
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#52c41a', display: 'inline-block' }} />
                  <span style={{ fontSize: '12px', color: '#52c41a', fontWeight: '500' }}>
                    {lang === 'zh' ? '条件1' : 'Condition 1'}
                  </span>
                </div>
                <textarea
                  value={(data.conditions?.[0]?.expression) || ''}
                  onChange={(e) => {
                    const newConditions = [...(data.conditions || [null, null])]
                    newConditions[0] = { ...(newConditions[0] || {}), expression: e.target.value }
                    handleChange('conditions', newConditions)
                  }}
                  placeholder={lang === 'zh' ? '例如: input.value > 100' : 'e.g., input.value > 100'}
                  style={{
                    ...inputStyle,
                    marginBottom: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    height: '48px',
                    resize: 'none'
                  }}
                  onFocus={(e) => e.target.style.border = colors.borderHover}
                  onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
                />
                <div style={{ fontSize: '10px', color: colors.textMuted }}>
                  {lang === 'zh' ? '连接到顶部左侧输出点 (无需输入分号)' : 'Connect to top-left handle (no semicolon needed)'}
                </div>
              </div>

              {/* 条件2 */}
              <div style={{
                padding: '14px',
                background: colors.bgCard,
                borderRadius: '8px',
                border: '1px solid rgba(24, 144, 255, 0.3)'
              }}>
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1890ff', display: 'inline-block' }} />
                  <span style={{ fontSize: '12px', color: '#1890ff', fontWeight: '500' }}>
                    {lang === 'zh' ? '条件2' : 'Condition 2'}
                  </span>
                </div>
                <textarea
                  value={(data.conditions?.[1]?.expression) || ''}
                  onChange={(e) => {
                    const newConditions = [...(data.conditions || [null, null])]
                    newConditions[1] = { ...(newConditions[1] || {}), expression: e.target.value }
                    handleChange('conditions', newConditions)
                  }}
                  placeholder={lang === 'zh' ? '例如: input.status === "active"' : 'e.g., input.status === "active"'}
                  style={{
                    ...inputStyle,
                    marginBottom: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    height: '48px',
                    resize: 'none'
                  }}
                  onFocus={(e) => e.target.style.border = colors.borderHover}
                  onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
                />
                <div style={{ fontSize: '10px', color: colors.textMuted }}>
                  {lang === 'zh' ? '连接到顶部右侧输出点 (无需输入分号)' : 'Connect to top-right handle (no semicolon needed)'}
                </div>
              </div>
            </div>

            {/* 提示信息 */}
            <div style={{
              padding: '14px',
              background: 'rgba(100, 180, 255, 0.08)',
              borderRadius: '8px',
              border: '1px solid rgba(100, 180, 255, 0.15)',
              fontSize: '11px',
              lineHeight: 1.8
            }}>
              <div style={{ color: colors.accent, fontWeight: '500', marginBottom: '6px', letterSpacing: '1px' }}>
                {t('hint').toUpperCase()}
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', color: colors.textSecondary }}>
                <li>{lang === 'zh' ? '每个条件从上到下依次判断' : 'Conditions are evaluated top to bottom'}</li>
                <li>{lang === 'zh' ? '第一个满足条件的分支会被执行' : 'First matching condition wins'}</li>
                <li><code style={{ color: '#8ec5fc' }}>input</code> {lang === 'zh' ? '可获取前一个节点的输出' : 'Access previous node output'}</li>
              </ul>
            </div>
          </>
        )}

        {/* 保存文件节点 */}
        {node.type === 'saveFile' && <SaveFileNodePanel node={node} data={data} handleChange={handleChange} t={t} executionStatus={executionStatus} />}

        {/* 保存为模板按钮 */}
        {node.type !== 'start' && node.type !== 'end' && (
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <Button
              onClick={() => {
                console.log('按钮点击, node:', node, 'onSaveAsTemplate:', onSaveAsTemplate)
                if (onSaveAsTemplate) onSaveAsTemplate(node)
              }}
              style={{
                width: '100%',
                background: 'rgba(100, 180, 255, 0.1)',
                borderColor: 'rgba(100, 180, 255, 0.3)',
                color: '#64b5f6'
              }}
            >
              <IconSave style={{ marginRight: '8px' }} />
              {lang === 'zh' ? '保存为模板' : 'Save as Template'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== 预设频率选项 ====================
const FREQUENCY_OPTIONS_EN = [
  { label: 'Every 5 min', value: 'interval', interval: 5 },
  // { label: 'Every 15 min', value: 'interval', interval: 15 },
  // { label: 'Every 30 min', value: 'interval', interval: 30 },
  // { label: 'Every hour', value: 'hourly' },
  // { label: 'Every 6 hours', value: 'interval', interval: 360 },
  ...Array.from({ length: 23 }, (_, i) => ({ label: `Daily at ${i + 1}:00`, value: 'daily', hour: i + 1, minute: 0 })),
  // { label: 'Weekly on Monday', value: 'weekly', day: 1, hour: 0, minute: 0 },
  // { label: 'Monthly on 1st', value: 'monthly', day: 1, hour: 0, minute: 0 },
]

const FREQUENCY_OPTIONS_ZH = [
  { label: '每5分钟', value: 'interval', interval: 5 },
  // { label: '每15分钟', value: 'interval', interval: 15 },
  // { label: '每30分钟', value: 'interval', interval: 30 },
  // { label: '每小时', value: 'hourly' },
  // { label: '每6小时', value: 'interval', interval: 360 },
  ...Array.from({ length: 23 }, (_, i) => ({ label: `每天${i + 1}点`, value: 'daily', hour: i + 1, minute: 0 })),
  // { label: '每周一', value: 'weekly', day: 1, hour: 0, minute: 0 },
  // { label: '每月1号', value: 'monthly', day: 1, hour: 0, minute: 0 },
]

function optionToCron(option) {
  switch (option.value) {
    case 'interval':
      if (option.interval < 60) return `*/${option.interval} * * * *`
      return `0 */${Math.floor(option.interval / 60)} * * *`
    case 'hourly': return '0 * * * *'
    case 'daily': return `${option.minute} ${option.hour} * * *`
    case 'weekly': return `${option.minute} ${option.hour} * * ${option.day}`
    case 'monthly': return `${option.minute} ${option.hour} ${option.day} * *`
    default: return '0 * * * *'
  }
}

function cronToDescription(cron) {
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron
  const [minute, hour, day, month, week] = parts
  if (minute.startsWith('*/') && hour === '*') return `Every ${minute.slice(2)} min`
  if (minute.startsWith('*/') && hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`
  if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && week === '*')
    return `Daily at ${hour}:${minute.padStart(2, '0')}`
  return cron
}

// ==================== 定时任务面板 ====================
function SchedulePanel({ workflowId }) {
  const { t, lang } = useLanguage()
  const [schedules, setSchedules] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [formData, setFormData] = useState({ name: '', frequency: 'hourly' })
  const [loading, setLoading] = useState(false)

  const loadSchedules = useCallback(async () => {
    if (!workflowId) {
      console.log('loadSchedules: workflowId 为空，跳过')
      return
    }
    try {
      console.log('加载定时任务列表，workflowId:', workflowId)
      const res = await fetch(`/api/schedules?workflowId=${workflowId}`)
      const data = await res.json()
      console.log('定时任务列表响应:', res.status, '数据:', data)
      setSchedules(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Load schedules failed:', error)
    }
  }, [workflowId])

  useEffect(() => { loadSchedules() }, [loadSchedules])

  const frequencyOptions = lang === 'zh' ? FREQUENCY_OPTIONS_ZH : FREQUENCY_OPTIONS_EN

  // 将 cron 转换为 frequency 选择值
  const cronToFrequency = (cron) => {
    if (!cron) return 'hourly'
    const parts = cron.split(' ')
    if (parts.length !== 5) return 'hourly'
    const [minute, hour, day, month, week] = parts

    if (minute.startsWith('*/') && hour === '*') return `every${minute.slice(2)}min`
    if (minute === '0' && hour.startsWith('*/')) return `every${hour.slice(2)}hour`
    if (minute === '0' && hour !== '*' && day === '*' && month === '*' && week === '*') return `daily${hour}`
    if (minute === '0' && hour !== '*' && day === '*' && month === '*' && week !== '*') return `weekly${week}`

    return 'hourly'
  }

  const handleOpenEdit = (schedule) => {
    setEditingSchedule(schedule)
    setFormData({
      name: schedule.name || '',
      frequency: cronToFrequency(schedule.cronExpression)
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const selectedOption = frequencyOptions.find(opt => opt.value + (opt.interval || opt.hour || '') === formData.frequency) || frequencyOptions[3]
    const cronExpression = optionToCron(selectedOption)
    setLoading(true)
    try {
      if (editingSchedule) {
        // 更新
        const res = await fetch(`/api/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formData.name || selectedOption.label, cronExpression })
        })
        if (!res.ok) throw new Error('Update failed')
        toast.success(t('schedule updated'))
      } else {
        // 创建
        const postData = { name: formData.name || selectedOption.label, workflowId, cronExpression }
        console.log('创建定时任务，发送数据:', postData)
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postData)
        })
        const result = await res.json()
        console.log('创建定时任务响应:', res.status, result)
        if (!res.ok) throw new Error(result.error || 'Create failed')
        toast.success(t('schedule created'))
      }
      loadSchedules()
      setShowForm(false)
      setEditingSchedule(null)
      setFormData({ name: '', frequency: 'hourly' })
    } catch (error) {
      console.error('创建定时任务失败:', error)
      toast.error(editingSchedule ? t('failed to update') : t('failed to create'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (schedule, enabled) => {
    try {
      await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: schedule.name, cronExpression: schedule.cronExpression, enabled: enabled ? 1 : 0 })
      })
      loadSchedules()
    } catch (error) {
      toast.error(t('failed to update'))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(lang === 'zh' ? '确定要删除这个定时任务吗？' : 'Are you sure you want to delete this schedule?')) {
      return
    }
    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      loadSchedules()
      toast.success(lang === 'zh' ? '删除成功' : 'Deleted successfully')
    } catch (error) {
      toast.error(t('failed to delete'))
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: '#e0e0e0',
    fontSize: '12px',
    outline: 'none',
    boxSizing: 'border-box'
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingSchedule(null)
    setFormData({ name: '', frequency: 'hourly' })
  }

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ margin: 0, fontSize: '13px', letterSpacing: '2px', color: colors.text }}>{t('schedule').toUpperCase()}</span>
        <span
          onClick={() => showForm ? handleCancel() : setShowForm(true)}
          style={{
            padding: '8px 16px',
            background: showForm ? 'transparent' : 'linear-gradient(135deg, rgba(100, 180, 255, 0.15) 0%, rgba(100, 180, 255, 0.05) 100%)',
            border: '1px solid rgba(100, 180, 255, 0.3)',
            borderRadius: '6px',
            color: '#8ec5fc',
            fontSize: '11px',
            letterSpacing: '1px',
            cursor: 'pointer'
          }}
        >
          {showForm ? t('cancel') : t('create space')}
        </span>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px', padding: '16px', background: colors.bgCard, borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '1px', color: colors.textSecondary }}>{t('schedule name').toUpperCase()}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('optional name')}
              style={inputStyle}
              onFocus={(e) => e.target.style.border = colors.borderHover}
              onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '1px', color: colors.textSecondary }}>{t('frequency').toUpperCase()}</label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              style={{ ...inputStyle, cursor: 'pointer' }}
              onFocus={(e) => e.target.style.border = colors.borderHover}
              onBlur={(e) => e.target.style.border = 'rgba(255, 255, 255, 0.1)'}
            >
              {frequencyOptions.map((opt, idx) => (
                <option key={idx} value={opt.value + (opt.interval || opt.hour || '')} style={{ background: '#1a1a2e' }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <span
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: 'linear-gradient(135deg, rgba(82, 196, 26, 0.2) 0%, rgba(82, 196, 26, 0.1) 100%)',
              border: '1px solid rgba(82, 196, 26, 0.4)',
              borderRadius: '6px',
              color: '#73d13d',
              fontSize: '12px',
              letterSpacing: '1px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? t('loading') : (editingSchedule ? (lang === 'zh' ? '保存' : 'Save') : t('create'))}
          </span>
        </form>
      )}

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {schedules.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', color: colors.textMuted, padding: '30px', fontSize: '12px', letterSpacing: '1px' }}>
            {t('no schedules yet')}
          </div>
        )}
        {schedules.map(schedule => (
          <div key={schedule.id} style={{
            padding: '14px',
            background: colors.bgCard,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>
                {schedule.name || t('schedule')}
              </div>
              <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '2px' }}>
                {cronToDescription(schedule.cronExpression)}
              </div>
              <div style={{ fontSize: '10px', color: schedule.enabled ? colors.success : colors.textMuted }}>
                {schedule.enabled ? t('enabled') : t('disabled')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                onClick={() => handleOpenEdit(schedule)}
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  border: '1px solid rgba(100, 180, 255, 0.25)',
                  borderRadius: '4px',
                  color: 'rgba(100, 180, 255, 0.7)',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                {lang === 'zh' ? '编辑' : 'Edit'}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={schedule.enabled === 1}
                  onChange={(e) => handleToggle(schedule, e.target.checked)}
                  style={{ accentColor: colors.accent }}
                />
                <span style={{ fontSize: '11px', color: colors.textSecondary }}>{t('on')}</span>
              </label>
              <span
                onClick={() => handleDelete(schedule.id)}
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 77, 79, 0.3)',
                  borderRadius: '4px',
                  color: 'rgba(255, 77, 79, 0.7)',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                {t('delete').toUpperCase().substring(0, 3)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ==================== 执行记录面板 ====================
function ExecutionPanel({ workflowId, onSelectLog, selectedLogId, selectedLog }) {
  const { t } = useLanguage()
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
  const [deletingId, setDeletingId] = useState(null)

  const loadLogs = useCallback(async (page = 1) => {
    if (!workflowId) return
    try {
      const res = await fetch(`/api/executions?workflowId=${workflowId}&page=${page}&pageSize=10`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : (data.list || []))
      setPagination(data.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('Load logs failed:', error)
    }
  }, [workflowId])

  useEffect(() => { loadLogs() }, [loadLogs])

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#52c41a'
      case 'failed': return '#ff4d4f'
      case 'running': return '#1890ff'
      default: return colors.textMuted
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'success': return t('success')
      case 'failed': return t('failed')
      case 'running': return t('running')
      default: return status?.toUpperCase() || 'UNKNOWN'
    }
  }

  const formatDuration = (start, end) => {
    if (!end) return t('running') + '...'
    const ms = new Date(end) - new Date(start)
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}${t('seconds')}`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const handleDeleteLog = async (log, e) => {
    e.stopPropagation()
    if (!window.confirm(`确定要删除这条执行记录吗？\n时间：${new Date(log.startedAt).toLocaleString()}`)) {
      return
    }
    try {
      setDeletingId(log.id)
      const res = await fetch(`/api/executions/${log.id}`, { method: 'DELETE' })
      if (res.ok) {
        // 如果删除的是当前选中的记录，清除选中状态
        if (selectedLogId === log.id) {
          onSelectLog(null)
        }
        // 重新加载列表
        loadLogs(pagination.page)
      }
    } catch (error) {
      console.error('删除执行记录失败:', error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ margin: 0, fontSize: '13px', letterSpacing: '2px', color: colors.text }}>{t('execution log').toUpperCase()}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span
            onClick={async () => {
              if (!confirm('确定要删除所有执行记录吗？将只保留最新一条。')) return
              try {
                const res = await fetch(`/api/workflows/${workflowId}/prune`, { method: 'DELETE' })
                if (res.ok) {
                  loadLogs(1)
                }
              } catch (error) {
                console.error('Prune failed:', error)
              }
            }}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(255, 77, 79, 0.3)',
              borderRadius: '6px',
              color: 'rgba(255, 77, 79, 0.7)',
              fontSize: '11px',
              letterSpacing: '1px',
              cursor: 'pointer'
            }}
          >
            {t('deleteOldRecords')}
          </span>
          <span
            onClick={loadLogs}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(100, 180, 255, 0.25)',
              borderRadius: '6px',
              color: 'rgba(100, 180, 255, 0.7)',
              fontSize: '11px',
              letterSpacing: '1px',
              cursor: 'pointer'
            }}
          >
            {t('refresh')}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '16px', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {logs.length === 0 && (
            <div style={{ textAlign: 'center', color: colors.textMuted, padding: '30px', fontSize: '12px', letterSpacing: '1px' }}>
              {t('no execution records')}
            </div>
          )}
          {logs.map(log => (
            <div
              key={log.id}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/executions/${log.id}`)
                  const data = await res.json()
                  onSelectLog(data)
                } catch (error) {
                  console.error('Get log failed:', error)
                }
              }}
              style={{
                padding: '12px 14px',
                background: selectedLogId === log.id ? 'rgba(100, 180, 255, 0.15)' : colors.bgCard,
                border: `1px solid ${selectedLogId === log.id ? 'rgba(100, 180, 255, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  padding: '3px 8px',
                  background: getStatusColor(log.status),
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  fontWeight: '500'
                }}>
                  {getStatusText(log.status)}
                </span>
                <span style={{ color: colors.textMuted, fontSize: '11px' }}>
                  {formatDuration(log.startedAt, log.finishedAt)}
                </span>
              </div>
              <div style={{ marginTop: '8px', color: colors.textSecondary, fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{new Date(log.startedAt).toLocaleString()}</span>
                <span
                  onClick={(e) => handleDeleteLog(log, e)}
                  disabled={deletingId === log.id}
                  style={{
                    padding: '3px 8px',
                    background: 'rgba(255, 77, 79, 0.1)',
                    border: '1px solid rgba(255, 77, 79, 0.25)',
                    borderRadius: '4px',
                    color: '#ff7875',
                    fontSize: '10px',
                    cursor: deletingId === log.id ? 'not-allowed' : 'pointer',
                    opacity: deletingId === log.id ? 0.5 : 1
                  }}
                >
                  {deletingId === log.id ? '删除中...' : '删除'}
                </span>
              </div>
            </div>
          ))}

          {/* 分页控件 */}
          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span
                onClick={() => loadLogs(pagination.page - 1)}
                style={{
                  padding: '6px 12px',
                  background: pagination.page <= 1 ? 'rgba(100,100,100,0.2)' : 'rgba(100,180,255,0.1)',
                  border: '1px solid rgba(100,180,255,0.2)',
                  borderRadius: '4px',
                  color: pagination.page <= 1 ? 'rgba(255,255,255,0.3)' : 'rgba(100,180,255,0.7)',
                  fontSize: '11px',
                  cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                {t('previous') || '上一页'}
              </span>
              <span style={{ color: colors.textMuted, fontSize: '11px' }}>
                {pagination.page} / {pagination.totalPages}
              </span>
              <span
                onClick={() => loadLogs(pagination.page + 1)}
                style={{
                  padding: '6px 12px',
                  background: pagination.page >= pagination.totalPages ? 'rgba(100,100,100,0.2)' : 'rgba(100,180,255,0.1)',
                  border: '1px solid rgba(100,180,255,0.2)',
                  borderRadius: '4px',
                  color: pagination.page >= pagination.totalPages ? 'rgba(255,255,255,0.3)' : 'rgba(100,180,255,0.7)',
                  fontSize: '11px',
                  cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                {t('next') || '下一页'}
              </span>
            </div>
          )}
        </div>

        {/* 执行详情 */}
        {selectedLog && selectedLog.id && (
          <div style={{
            width: '400px',
            padding: '16px',
            background: colors.bgCard,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            fontSize: '12px',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ margin: 0, fontSize: '12px', letterSpacing: '1px', color: colors.text }}>{t('details')}</span>
              <span
                onClick={() => onSelectLog(null)}
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: colors.textSecondary,
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                {t('close')}
              </span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ color: colors.textSecondary, fontSize: '11px', letterSpacing: '1px' }}>STATUS </span>
              <span style={{ color: getStatusColor(selectedLog?.status), marginLeft: '8px' }}>
                {getStatusText(selectedLog?.status)}
              </span>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ color: colors.textSecondary, fontSize: '11px', letterSpacing: '1px' }}>{t('duration').toUpperCase()} </span>
              <span style={{ color: colors.text, marginLeft: '8px' }}>
                {formatDuration(selectedLog?.startedAt, selectedLog?.finishedAt)}
              </span>
            </div>

            {selectedLog?.error && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', letterSpacing: '1px', color: colors.error, marginBottom: '6px' }}>{t('error')}</div>
                <pre style={{
                  background: 'rgba(255, 77, 79, 0.1)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  overflow: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: '#ff7875',
                  border: '1px solid rgba(255, 77, 79, 0.2)'
                }}>
                  {selectedLog.error}
                </pre>
              </div>
            )}

            {selectedLog?.nodeExecutions && selectedLog.nodeExecutions.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', letterSpacing: '1px', color: colors.textSecondary, marginBottom: '12px' }}>{t('node details')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedLog.nodeExecutions.map((node, idx) => (
                    <div
                      key={node.id || idx}
                      style={{
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '8px',
                        padding: '12px',
                        background: node.status === 'failed' ? 'rgba(255, 77, 79, 0.08)' : 'rgba(255, 255, 255, 0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: colors.text, fontWeight: '500' }}>
                          {idx + 1}. {node.nodeName || node.nodeId}
                        </span>
                        <span style={{
                          padding: '2px 6px',
                          background: getStatusColor(node.status),
                          color: '#fff',
                          borderRadius: '3px',
                          fontSize: '10px'
                        }}>
                          {getStatusText(node.status)}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '8px' }}>
                        {t('type')}: {node.nodeType?.toUpperCase()}
                      </div>

                      {node.error && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '10px', color: colors.error, marginBottom: '4px' }}>{t('error')}</div>
                          <pre style={{
                            background: 'rgba(255, 77, 79, 0.1)',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: '60px',
                            overflow: 'auto',
                            color: '#ff7875'
                          }}>
                            {node.error}
                          </pre>
                        </div>
                      )}

                      {node.input !== undefined && node.input !== null && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '10px', color: colors.accent, marginBottom: '4px' }}>{t('input').toUpperCase()}</div>
                          <pre style={{
                            background: 'rgba(100, 180, 255, 0.08)',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: '80px',
                            overflow: 'auto',
                            color: '#8ec5fc'
                          }}>
                            {typeof node.input === 'object' ? JSON.stringify(node.input, null, 2) : String(node.input)}
                          </pre>
                        </div>
                      )}

                      {node.output !== undefined && node.output !== null && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '10px', color: colors.success, marginBottom: '4px' }}>{t('output').toUpperCase()}</div>
                          <pre style={{
                            background: 'rgba(82, 196, 26, 0.08)',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: '100px',
                            overflow: 'auto',
                            color: '#73d13d'
                          }}>
                            {typeof node.output === 'object' ? JSON.stringify(node.output, null, 2) : String(node.output)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(selectedLog && (!selectedLog.nodeExecutions || selectedLog.nodeExecutions.length === 0)) && (
              <div style={{ color: colors.textMuted, fontSize: '11px', textAlign: 'center', padding: '20px', letterSpacing: '1px' }}>
                {t('no node details')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
// ==================== 主工作流编辑器 ====================
const nodeTemplates_EN = [
  { type: 'start', label: 'START', color: '#64b5f6' },
  { type: 'http', label: 'HTTP', color: '#9c27b0' },
  { type: 'dataProcess', label: 'PROCESS', color: '#ff9800' },
  { type: 'condition', label: 'IF', color: '#e91e63' },
  { type: 'saveFile', label: 'SAVE', color: '#52c41a' },
  { type: 'end', label: 'END', color: '#4caf50' },
]

const nodeTemplates_ZH = [
  { type: 'start', label: '开始', color: '#64b5f6' },
  { type: 'http', label: 'HTTP', color: '#9c27b0' },
  { type: 'dataProcess', label: '处理', color: '#ff9800' },
  { type: 'condition', label: '条件', color: '#e91e63' },
  { type: 'saveFile', label: '保存', color: '#52c41a' },
  { type: 'end', label: '结束', color: '#4caf50' },
]

let nodeIdCounter = 100

function WorkflowEditorInner() {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const { fitView } = useReactFlow()
  const { t, lang } = useLanguage()
  const nodeTemplates = lang === 'zh' ? nodeTemplates_ZH : nodeTemplates_EN

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const [workflow, setWorkflow] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('schedule')
  const [executing, setExecuting] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)

  // 底部面板状态 - 可拖动调整大小
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [panelHeight, setPanelHeight] = useState(280)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const containerRef = useRef(null)

  // 执行记录相关状态
  const [selectedLog, setSelectedLog] = useState(null)

  // 模板相关
  const {
    templates: savedTemplates,
    saveAsTemplate,
    deleteTemplate,
    createNodeFromTemplate
  } = useNodeTemplates()

  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [saveTemplateModalVisible, setSaveTemplateModalVisible] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateNodeData, setTemplateNodeData] = useState(null)

  // 保存节点为模板
  const handleSaveAsTemplate = useCallback((node) => {
    console.log('保存模板被调用:', node)
    setTemplateNodeData({ ...node })
    setTemplateName(node.data?.label || '')
    setSaveTemplateModalVisible(true)
    console.log('saveTemplateModalVisible 设置为 true')
  }, [])

  const confirmSaveTemplate = useCallback(() => {
    if (!templateName.trim() || !templateNodeData) return
    saveAsTemplate(templateNodeData, templateName.trim())
    toast.success(lang === 'zh' ? '模板已保存' : 'Template saved')
    setSaveTemplateModalVisible(false)
    setTemplateName('')
    setTemplateNodeData(null)
  }, [templateName, templateNodeData, saveAsTemplate, lang])

  // 从模板添加节点
  const handleAddFromTemplate = useCallback((template) => {
    const newNode = createNodeFromTemplate(template)
    setNodes((prev) => [...prev, newNode])
    setSelectedNode(newNode)
    setTemplateModalVisible(false)
  }, [setNodes, createNodeFromTemplate])

  // 处理选择执行记录
  const handleSelectLog = useCallback((log) => {
    setSelectedLog(log)
  }, [])

  // 根据选中的执行记录获取节点的执行状态
  const getNodeExecutionStatus = useCallback((nodeId) => {
    if (!selectedLog?.nodeExecutions) return null
    return selectedLog.nodeExecutions.find(n => n.nodeId === nodeId)
  }, [selectedLog])

  // 计算需要高亮的边（执行路径）
  const highlightedEdges = useMemo(() => {
    if (!selectedLog?.nodeExecutions || selectedLog.nodeExecutions.length === 0) return new Set()
    
    const executedNodeIds = selectedLog.nodeExecutions.map(n => n.nodeId)
    const highlighted = new Set()
    
    edges.forEach(edge => {
      // 检查这条边连接的源节点和目标节点是否都被执行
      if (executedNodeIds.includes(edge.source) && executedNodeIds.includes(edge.target)) {
        // 对于条件节点，需要检查 sourceHandle 是否匹配
        const sourceNode = nodes.find(n => n.id === edge.source)
        if (sourceNode?.type === 'condition') {
          // 找到条件节点的执行记录
          const conditionExec = selectedLog.nodeExecutions.find(n => n.nodeId === edge.source)
          if (conditionExec?.output?.selected !== undefined) {
            // Handle ID 映射: "yes" -> 0, "no" -> 1, "default" -> 2
            const handleMap = { 'yes': 0, 'no': 1, 'default': 2 }
            const edgeIndex = edge.sourceHandle ? (handleMap[edge.sourceHandle] ?? 0) : 0
            // 只有匹配的边才高亮
            if (edgeIndex === conditionExec.output.selected) {
              highlighted.add(edge.id)
            }
          } else {
            // 没有 selected 输出时，默认高亮 "yes" 和 "default" 边
            if (edge.sourceHandle === 'yes' || edge.sourceHandle === 'default') {
              highlighted.add(edge.id)
            }
          }
        } else {
          // 普通节点只要两端都执行了就高亮
          highlighted.add(edge.id)
        }
      }
    })
    
    return highlighted
  }, [selectedLog, edges, nodes])

  // 边的样式
  const getEdgeStyle = useCallback((edge) => {
    if (!selectedLog?.nodeExecutions) return { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 }
    const isHighlighted = highlightedEdges.has(edge.id)
    const hasError = selectedLog.nodeExecutions.some ? selectedLog.nodeExecutions.some(n => n.status === 'failed') : false
    return {
      stroke: isHighlighted ? (hasError ? '#ff4d4f' : '#52c41a') : 'rgba(255, 255, 255, 0.15)',
      strokeWidth: isHighlighted ? 2 : 1,
      transition: 'all 0.3s ease'
    }
  }, [selectedLog, highlightedEdges])

  // 更新节点的内部（当节点有多个 Handle 时需要）
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    nodes.forEach(node => {
      if (node.type === 'condition' || node.type === 'branch') {
        updateNodeInternals(node.id)
      }
    })
  }, [nodes, updateNodeInternals])

  // 处理节点数据变化
  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } }
        }
        return node
      })
    )
    setSelectedNode((prev) => prev && prev.id === nodeId ? { ...prev, data: newData } : prev)
  }, [setNodes])

  // 节点点击处理
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node)
  }, [])

  // 点击空白区域关闭面板
  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // 关闭属性面板
  const closePropertyPanel = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // 拖动调整大小
  const handleDragStart = useCallback((e) => {
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartHeight.current = panelHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [panelHeight])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      const delta = dragStartY.current - e.clientY
      const newHeight = Math.max(100, Math.min(600, dragStartHeight.current + delta))
      setPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // 节点组件样式
  const getNodeStyles = (type, execStatus, selected) => {
    let bg, border, textColor
    const isSuccess = execStatus?.status === 'success'
    const isFailed = execStatus?.status === 'failed'
    const isRunning = execStatus?.status === 'running'

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

    return { bg, border, textColor }
  }

  // 节点组件 - 银灰色科技风格
  const SilverNodeComponent = ({ data, selected, id, type, icon, title }) => {
    const execStatus = getNodeExecutionStatus(id)
    const { bg, border, textColor } = getNodeStyles(type, execStatus, selected)
    const statusIcon = execStatus?.status === 'success' ? '✓' : execStatus?.status === 'failed' ? '✗' : execStatus?.status === 'running' ? '⟳' : null

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
        <div style={{ fontWeight: '600', color: textColor, fontSize: '13px', letterSpacing: '1px', marginBottom: '4px' }}>
          {icon} {title}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data?.label || data?.url || data?.code?.split('\n')[0] || t('not configured')}
        </div>
        {selected && (execStatus?.input !== undefined || execStatus?.output !== undefined) && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {execStatus?.input !== undefined && execStatus?.input !== null && (
              <div style={{ padding: '4px 6px', background: 'rgba(100, 180, 255, 0.1)', borderRadius: '4px', fontSize: '10px' }}>
                <span style={{ color: '#8ec5fc' }}>IN:</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', marginLeft: '4px' }}>
                  {typeof execStatus.input === 'object' ? JSON.stringify(execStatus.input).substring(0, 30) : String(execStatus.input).substring(0, 30)}...
                </span>
              </div>
            )}
            {execStatus?.output !== undefined && execStatus?.output !== null && (
              <div style={{ padding: '4px 6px', background: 'rgba(82, 196, 26, 0.1)', borderRadius: '4px', fontSize: '10px' }}>
                <span style={{ color: '#73d13d' }}>OUT:</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)', marginLeft: '4px' }}>
                  {typeof execStatus.output === 'object' ? JSON.stringify(execStatus.output).substring(0, 30) : String(execStatus.output).substring(0, 30)}...
                </span>
              </div>
            )}
          </div>
        )}
        <Handle type="source" position={Position.Right} style={{ background: 'rgba(255, 255, 255, 0.3)' }} />
      </div>
    )
  }

  const HttpNodeComponent = (props) => <SilverNodeComponent {...props} type="http" icon="🌐" title={t('http request')} />
  const DataProcessNodeComponent = (props) => <SilverNodeComponent {...props} type="dataProcess" icon="⚙️" title={t('data process')} />
  const StartNodeComponent = (props) => <SilverNodeComponent {...props} type="start" icon="▶" title={t('start')} />
  const EndNodeComponent = (props) => <SilverNodeComponent {...props} type="end" icon="■" title={t('end')} />

  // 保存文件节点包装器
  const SaveFileNodeComponent = (props) => (
    <SaveFileNode
      {...props}
      executionStatus={getNodeExecutionStatus(props.id)}
    />
  )

  // 条件节点包装器
  const ConditionNodeComponent = (props) => (
    <ConditionNode
      {...props}
      executionStatus={getNodeExecutionStatus(props.id)}
      lang={lang}
      colors={colors}
    />
  )

  // 使用 useMemo 包装 nodeTypes
  const nodeTypes = useMemo(() => ({
    http: HttpNodeComponent,
    dataProcess: DataProcessNodeComponent,
    saveFile: SaveFileNodeComponent,
    condition: ConditionNodeComponent,
    start: StartNodeComponent,
    end: EndNodeComponent,
  }), [getNodeExecutionStatus, t, lang])

  // 加载工作空间和工作流
  const loadData = useCallback(async () => {
    if (!workspaceId) return

    try {
      setLoading(true)
      setError(null)

      const wsRes = await fetch(`/api/workspaces/${workspaceId}`)
      if (!wsRes.ok) throw new Error('Workspace not found')
      const wsData = await wsRes.json()
      setWorkspace(wsData)

      const wfRes = await fetch(`/api/workflows?workspaceId=${workspaceId}`)
      if (!wfRes.ok) throw new Error('Failed to load workflow')
      const wfData = await wfRes.json()

      if (Array.isArray(wfData) && wfData.length > 0) {
        const wf = wfData[0]
        setWorkflow(wf)
        const savedNodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : (wf.nodes || [])
        const savedEdges = typeof wf.edges === 'string' ? JSON.parse(wf.edges) : (wf.edges || [])
        setNodes(savedNodes, false)
        setEdges(savedEdges, false)
      } else {
        const defaultNodes = [
          { id: '1', type: 'start', position: { x: 100, y: 200 }, data: { label: 'Start' } },
          { id: '2', type: 'end', position: { x: 500, y: 200 }, data: { label: 'End' } },
        ]
        const defaultEdges = [
          { id: 'e1-2', source: '1', target: '2', animated: true, type: 'straight' },
        ]

        const newWf = await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            name: wsData.name || 'New Workflow',
            nodes: JSON.stringify(defaultNodes),
            edges: JSON.stringify(defaultEdges)
          })
        }).then(r => r.json())
        setWorkflow(newWf)
        setNodes(defaultNodes, false)
        setEdges(defaultEdges, false)
      }

      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100)
    } catch (err) {
      console.error('Load failed:', err)
      setError(err.message || 'Failed to load, please check if backend is running')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, setNodes, setEdges, fitView])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 生成唯一ID
  const generateNodeId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // 添加节点
  const addNode = useCallback((type) => {
    const template = nodeTemplates.find(n => n.type === type)
    const newNode = {
      id: generateNodeId(),
      type,
      position: { x: Math.random() * 300 + 200, y: Math.random() * 200 + 100 },
      data: {
        label: template.label,
        ...(type === 'http' && { method: 'GET', url: '', headers: '{}', body: '' }),
        ...(type === 'dataProcess' && { code: '// Write your logic here\nconst result = input;\nreturn result;' }),
        ...(type === 'condition' && { conditions: [null, null] }),
        ...(type === 'saveFile' && { fileName: '', dirPath: '', fileContent: '' }),
      },
    }
    setNodes((prev) => [...prev, newNode])
    setSelectedNode(newNode)
  }, [setNodes, lang, nodeTemplates])

  // 处理连接
  const onConnect = useCallback((params) => {
    console.log('连接参数:', params);
    const edgeId = params.id || (params.sourceHandle
      ? `e${params.source}-${params.sourceHandle}-${params.target}`
      : `e${params.source}-${params.target}`);
    const newEdge = {
      ...params,
      id: edgeId,
      sourceHandle: params.sourceHandle, // 确保保留 sourceHandle
      animated: true
    }
    console.log('创建边:', newEdge);
    setEdges((prev) => {
      // 检查是否已存在相同的边
      const exists = prev.some(e =>
        e.source === newEdge.source &&
        e.target === newEdge.target &&
        e.sourceHandle === newEdge.sourceHandle
      );
      if (exists) return prev;
      return [...prev, newEdge];
    })
  }, [setEdges])

  // 保存工作流
  const handleSave = async () => {
    if (!workflow) {
      toast.error(t('workflow not initialized'))
      return
    }

    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workspace?.name || t('workflow'),
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify(edges)
        })
      })

      if (res.ok) {
        const updated = await res.json()
        setWorkflow(updated)
        toast.success(t('save successfully'))
      } else {
        const err = await res.json()
        toast.error(t('save successfully') + ': ' + err.error)
      }
    } catch (error) {
      toast.error(t('save successfully') + ': ' + error.message)
    }
  }

  // 立即执行
  const handleExecute = async () => {
    if (!workflow) {
      toast.error(t('please save first'))
      return
    }

    setExecuting(true)
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/execute`, { method: 'POST' })
      const result = await res.json()

      if (result.status === 'success') {
        const duration = result.finishedAt ? ((new Date(result.finishedAt) - new Date(result.startedAt)) / 1000).toFixed(2) : 0
        toast.success(t('execution successful') + ` ${t('duration')}: ${duration}${t('seconds')}`)
        setActiveTab('execution')
        setIsPanelCollapsed(false)
      } else {
        toast.error(t('execution failed') + `: ${result.error}`)
      }
    } catch (error) {
      toast.error(t('execution failed') + ': ' + error.message)
    } finally {
      setExecuting(false)
    }
  }

  const handleBack = () => navigate('/workspaces')

  if (loading) return <Spin size="large" tip="Loading..." />
  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px' }}>
      <Text type="danger">{error}</Text>
      <Button onClick={loadData}>Retry</Button>
    </div>
  )

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: colors.bgPrimary }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: 'linear-gradient(180deg, rgba(20, 20, 35, 0.95) 0%, rgba(15, 15, 25, 0.9) 100%)',
        backdropFilter: 'blur(10px)'
      }}>
        <Button
          theme="borderless"
          type="tertiary"
          style={{color: colors.text}}
          icon={<IconChevronLeft />}
          onClick={handleBack}
        >
          {t('back')}
        </Button>
        <Text strong style={{ fontSize: '14px', color: colors.text }}>
          {workspace?.name || t('workflow')}
        </Text>
        <div style={{ flex: 1 }} />
        <Space spacing={12}>
          <Tooltip content={t('click node edit')}>
            <Button
              theme="borderless"
              type="tertiary"
              icon={<IconHelpCircle />}
            />
          </Tooltip>
          <Button
            onClick={handleSave}
            theme="light"
          >
            {t('save')}
          </Button>
          <Button
            onClick={handleExecute}
            loading={executing}
            theme="solid"
            type="primary"
          >
            {executing ? t('running...') : t('run')}
          </Button>
        </Space>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* 左侧节点面板 */}
        <div style={{
          width: '140px',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px 12px',
          background: colors.bgSecondary,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <Text type="tertiary" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '8px', textAlign: 'center', letterSpacing: '1px', color: colors.text }}>
            {lang === 'zh' ? '节点' : 'NODES'}
          </Text>
          {nodeTemplates.map((node) => (
            <Button
              key={node.type}
              onClick={() => addNode(node.type)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: colors.text,
                fontSize: '12px',
                letterSpacing: '1px',
                height: 'auto',
                padding: '10px 8px'
              }}
            >
              {node.label}
            </Button>
          ))}

          {/* 模板相关按钮 */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '8px', paddingTop: '8px' }}>
            <Button
              onClick={() => setTemplateModalVisible(true)}
              style={{
                width: '100%',
                background: 'rgba(100, 180, 255, 0.1)',
                borderColor: 'rgba(100, 180, 255, 0.3)',
                color: '#64b5f6',
                fontSize: '11px',
                letterSpacing: '1px',
                height: 'auto',
                padding: '8px'
              }}
            >
              {lang === 'zh' ? '模板库' : 'Templates'}
              {savedTemplates.length > 0 && (
                <span style={{ 
                  marginLeft: '4px', 
                  background: '#64b5f6', 
                  color: '#000', 
                  borderRadius: '50%', 
                  width: '16px', 
                  height: '16px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {savedTemplates.length}
                </span>
              )}
            </Button>
          </div>

          <div style={{ marginTop: 'auto', padding: '12px', background: colors.bgCard, borderRadius: '8px', fontSize: '10px', color: colors.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
            {t('click node edit')}
          </div>
        </div>

        {/* 流程图区域 */}
        <div style={{ flex: 1, position: 'relative', background: colors.bgPrimary }}>
          <ReactFlow
            nodes={nodes}
            edges={edges.map(e => ({ ...e, style: getEdgeStyle(e) }))}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: 'transparent' }}
          >
            <Background
              variant="dots"
              gap={20}
              size={1}
              color="rgba(255, 255, 255, 0.05)"
            />
            <Controls
              style={{
                background: 'rgba(20, 20, 35, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px'
              }}
            />
            <MiniMap
              style={{
                background: 'rgba(20, 20, 35, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px'
              }}
              nodeColor={(node) => {
                switch (node.type) {
                  case 'http': return '#9c27b0'
                  case 'dataProcess': return '#ff9800'
                  case 'condition': return '#e91e63'
                  case 'start': return '#64b5f6'
                  case 'end': return '#52c41a'
                  default: return '#666'
                }
              }}
            />
          </ReactFlow>

          {/* 右侧属性编辑面板 */}
          {selectedNode && (
            <PropertyPanel
              node={selectedNode}
              onClose={closePropertyPanel}
              onUpdate={updateNodeData}
              onSaveAsTemplate={handleSaveAsTemplate}
              executionStatus={getNodeExecutionStatus(selectedNode.id)}
            />
          )}
        </div>
      </div>

      {/* 底部面板 - 可拖动调整大小 */}
      <div style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: colors.bgSecondary,
        display: 'flex',
        flexDirection: 'column',
        height: isPanelCollapsed ? '40px' : panelHeight,
        transition: isDragging ? 'none' : 'height 0.2s'
      }}>
        {/* 拖动手柄 */}
        <div
          style={{
            height: '8px',
            background: isDragging ? 'rgba(100, 180, 255, 0.2)' : 'transparent',
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: isPanelCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.05)'
          }}
          onMouseDown={handleDragStart}
        >
          <div style={{
            width: '40px',
            height: '4px',
            background: isDragging ? '#64b5f6' : 'rgba(255, 255, 255, 0.2)',
            borderRadius: '2px'
          }} />
        </div>

        {/* 可折叠头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            height: '32px',
            cursor: 'pointer'
          }}
          onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
        >
          <span style={{
            fontSize: '12px',
            marginRight: '8px',
            transition: 'transform 0.2s',
            transform: isPanelCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            display: 'inline-block',
            color: colors.textSecondary
          }}>
            ▼
          </span>
          <span style={{ fontSize: '12px', color: colors.textSecondary, letterSpacing: '1px' }}>
            {isPanelCollapsed ? 'EXPAND PANEL' : 'PANEL'}
          </span>
        </div>

        {/* 标签切换 */}
        {!isPanelCollapsed && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <span
              onClick={() => setActiveTab('schedule')}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderBottom: activeTab === 'schedule' ? '2px solid #64b5f6' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === 'schedule' ? '#8ec5fc' : colors.textSecondary,
                fontWeight: activeTab === 'schedule' ? '600' : '400',
                cursor: 'pointer',
                fontSize: '12px',
                letterSpacing: '1px',
                transition: 'all 0.2s'
              }}
            >
              ⏰ {t('schedule')}
            </span>
            <span
              onClick={() => setActiveTab('execution')}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderBottom: activeTab === 'execution' ? '2px solid #64b5f6' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === 'execution' ? '#8ec5fc' : colors.textSecondary,
                fontWeight: activeTab === 'execution' ? '600' : '400',
                cursor: 'pointer',
                fontSize: '12px',
                letterSpacing: '1px',
                transition: 'all 0.2s'
              }}
            >
              📋 {t('execution log').substring(0, 4).toUpperCase()}
            </span>
          </div>
        )}

        {/* 面板内容 */}
        {!isPanelCollapsed && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'schedule' && workflow && <SchedulePanel workflowId={workflow.id} />}
            {activeTab === 'execution' && workflow && (
              <ExecutionPanel
                workflowId={workflow.id}
                onSelectLog={handleSelectLog}
                selectedLogId={selectedLog?.id}
                selectedLog={selectedLog}
              />
            )}
          </div>
        )}
      </div>

      {/* 模板选择弹窗 */}
      <Modal
        visible={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        title={lang === 'zh' ? '选择模板' : 'Select Template'}
        footer={null}
        width={520}
        style={{ top: 80 }}
      >
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {['http', 'dataProcess', 'condition'].map(type => {
            const typeTemplates = savedTemplates.filter(t => t.type === type)
            const typeLabels = {
              http: lang === 'zh' ? 'HTTP请求' : 'HTTP Request',
              dataProcess: lang === 'zh' ? '数据处理' : 'Data Process',
              condition: lang === 'zh' ? '条件判断' : 'Condition'
            }
            return (
              <div key={type} style={{ marginBottom: '20px' }}>
                <Text strong style={{ color: '#e0e0e0', display: 'block', marginBottom: '10px', fontSize: '13px' }}>
                  {typeLabels[type]} ({typeTemplates.length})
                </Text>
                {typeTemplates.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {typeTemplates.map(template => (
                      <div
                        key={template.id}
                        onClick={() => handleAddFromTemplate(template)}
                        style={{
                          padding: '12px 16px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid rgba(255,255,255,0.06)',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(100, 180, 255, 0.1)'
                          e.currentTarget.style.borderColor = 'rgba(100, 180, 255, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                        }}
                      >
                        <div>
                          <div style={{ color: '#e0e0e0', fontSize: '13px', marginBottom: '4px' }}>{template.name}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                            {new Date(template.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          size="small"
                          type="danger"
                          icon={<IconDelete />}
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTemplate(template.id)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.3)', padding: '16px', textAlign: 'center', fontSize: '12px' }}>
                    {lang === 'zh' ? '暂无模板' : 'No templates'}
                  </div>
                )}
              </div>
            )
          })}
          {savedTemplates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                {lang === 'zh' ? '暂无保存的模板' : 'No saved templates'}
              </div>
              <div style={{ fontSize: '12px' }}>
                {lang === 'zh' ? '在右侧面板中点击"保存为模板"来创建' : 'Click "Save as Template" in the right panel to create one'}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 保存模板弹窗 */}
      <Modal
        visible={saveTemplateModalVisible}
        onCancel={() => setSaveTemplateModalVisible(false)}
        title={lang === 'zh' ? '保存为模板' : 'Save as Template'}
        footer={
          <Space>
            <Button onClick={() => setSaveTemplateModalVisible(false)}>
              {lang === 'zh' ? '取消' : 'Cancel'}
            </Button>
            <Button type="primary" onClick={confirmSaveTemplate} disabled={!templateName.trim()}>
              {lang === 'zh' ? '保存' : 'Save'}
            </Button>
          </Space>
        }
        width={400}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="tertiary" style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
            {lang === 'zh' ? '模板名称' : 'Template Name'}
          </Text>
          <Input
            value={templateName}
            onChange={setTemplateName}
            placeholder={lang === 'zh' ? '输入模板名称' : 'Enter template name'}
            style={{ width: '100%' }}
            autofocus
          />
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          {lang === 'zh' ? '保存后将可以在其他工作流中快速添加此节点配置' : 'After saving, you can quickly add this node configuration in other workflows'}
        </div>
      </Modal>
    </div>
  )
}

// ==================== 导出组件 ====================
export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  )
}
