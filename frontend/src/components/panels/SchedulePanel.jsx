import { useState, useEffect } from 'react'
import { toast } from '../Toast'

export default function SchedulePanel({ workspaceId }) {
  const [schedules, setSchedules] = useState([])
  const [workflows, setWorkflows] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', workflowId: '', cronExpression: '* * * * *' })

  const loadSchedules = async () => {
    try {
      const res = await fetch('/api/schedules')
      const data = await res.json()
      setSchedules(data)
    } catch (error) {
      console.error('加载定时任务失败:', error)
    }
  }

  const loadWorkflows = async () => {
    try {
      const res = await fetch(`/api/workflows?workspaceId=${workspaceId}`)
      const data = await res.json()
      setWorkflows(data)
    } catch (error) {
      console.error('加载工作流失败:', error)
    }
  }

  useEffect(() => {
    loadSchedules()
    loadWorkflows()
  }, [workspaceId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.workflowId || !formData.cronExpression) {
      toast.error('请选择工作流和��入 Cron 表达式')
      return
    }

    try {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      loadSchedules()
      setShowForm(false)
      setFormData({ name: '', workflowId: '', cronExpression: '* * * * *' })
      toast.success('创建成功')
    } catch (error) {
      toast.error('创建失败')
    }
  }

  const handleToggle = async (id, enabled) => {
    try {
      await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enabled ? 1 : 0 })
      })
      loadSchedules()
      toast.success(enabled ? '已启用' : '已禁用')
    } catch (error) {
      toast.error('更新失败')
    }
  }

  const handleTrigger = async (id) => {
    try {
      const res = await fetch(`/api/schedules/${id}/trigger`, { method: 'POST' })
      const result = await res.json()
      if (result.executionResult?.status === 'success') {
        toast.success('执行成功')
      } else {
        toast.error(`执行失败: ${result.executionResult?.error}`)
      }
    } catch (error) {
      toast.error('执行失败')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个定时任务吗？')) return
    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      loadSchedules()
      toast.success('删除成功')
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const workspaceWorkflows = workflows.filter(wf => wf.workspaceId === workspaceId)
  const workspaceSchedules = schedules.filter(s => {
    const wf = workflows.find(w => w.id === s.workflowId)
    return wf?.workspaceId === workspaceId
  })

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '14px',
    outline: 'none'
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '500',
            color: '#e8e8e8',
            letterSpacing: '1px'
          }}>
            定时任务
          </h2>
          <p style={{
            margin: '6px 0 0 0',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.35)'
          }}>
            管理自动化工作流的定时执行
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 18px',
            background: showForm ? 'transparent' : 'linear-gradient(135deg, rgba(100, 180, 255, 0.15) 0%, rgba(100, 180, 255, 0.08) 100%)',
            border: '1px solid rgba(100, 180, 255, 0.3)',
            borderRadius: '8px',
            color: '#8ec5fc',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (!showForm) {
              e.target.style.background = 'linear-gradient(135deg, rgba(100, 180, 255, 0.25) 0%, rgba(100, 180, 255, 0.15) 100%)'
            }
          }}
          onMouseLeave={(e) => {
            if (!showForm) {
              e.target.style.background = 'linear-gradient(135deg, rgba(100, 180, 255, 0.15) 0%, rgba(100, 180, 255, 0.08) 100%)'
            }
          }}
        >
          {showForm ? '✕ 取消' : '+ 创建任务'}
        </button>
      </div>

      {/* 创建表单 */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{
          marginBottom: '24px',
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.7) 0%, rgba(20, 20, 35, 0.85) 100%)',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(100, 180, 255, 0.5), transparent)'
          }} />

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              任务名称
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="输入任务名称"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              选择工作流
            </label>
            <select
              value={formData.workflowId}
              onChange={(e) => setFormData({...formData, workflowId: e.target.value})}
              style={{
                ...inputStyle,
                cursor: 'pointer'
              }}
            >
              <option value="" style={{ background: '#1a1a2e' }}>请选择工作流</option>
              {workspaceWorkflows.map(wf => (
                <option key={wf.id} value={wf.id} style={{ background: '#1a1a2e' }}>
                  {wf.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              Cron 表达式
            </label>
            <input
              type="text"
              value={formData.cronExpression}
              onChange={(e) => setFormData({...formData, cronExpression: e.target.value})}
              placeholder="* * * * * (分 时 日 月 周)"
              style={inputStyle}
            />
            <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>
              示例: * * * * * (每分钟) | 0 * * * * (每小时) | 0 0 * * * (每天)
            </p>
          </div>

          <button type="submit" style={{
            padding: '10px 24px',
            background: 'linear-gradient(135deg, rgba(82, 196, 26, 0.2) 0%, rgba(82, 196, 26, 0.1) 100%)',
            border: '1px solid rgba(82, 196, 26, 0.4)',
            borderRadius: '8px',
            color: '#73d13d',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}>
            创建
          </button>
        </form>
      )}

      {/* 任务列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {workspaceSchedules.map(schedule => {
          const workflow = workflows.find(w => w.id === schedule.workflowId)
          return (
            <div
              key={schedule.id}
              style={{
                padding: '18px 20px',
                background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.6) 0%, rgba(20, 20, 35, 0.75) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(250, 140, 22, 0.15)',
                    border: '1px solid rgba(250, 140, 22, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px'
                  }}>
                    ⏰
                  </span>
                  <h4 style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: '500',
                    color: '#e8e8e8'
                  }}>
                    {schedule.name}
                  </h4>
                  {schedule.enabled ? (
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(82, 196, 26, 0.15)',
                      border: '1px solid rgba(82, 196, 26, 0.3)',
                      borderRadius: '10px',
                      color: '#73d13d',
                      fontSize: '10px'
                    }}>
                      运行中
                    </span>
                  ) : (
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: 'rgba(255, 255, 255, 0.3)',
                      fontSize: '10px'
                    }}>
                      已禁用
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.35)',
                  display: 'flex',
                  gap: '16px'
                }}>
                  <span>工作流: <span style={{ color: '#e8e8e8' }}>{workflow?.name || '未知'}</span></span>
                  <span>表达式: <span style={{
                    padding: '2px 8px',
                    background: 'rgba(100, 180, 255, 0.1)',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}>{schedule.cronExpression}</span></span>
                  <span>下次: <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : 'N/A'}
                  </span></span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: schedule.enabled ? '#73d13d' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={schedule.enabled === 1}
                    onChange={(e) => handleToggle(schedule.id, e.target.checked)}
                    style={{ accentColor: '#73d13d' }}
                  />
                  启用
                </label>
                <button
                  onClick={() => handleTrigger(schedule.id)}
                  style={{
                    padding: '6px 14px',
                    background: 'rgba(250, 140, 22, 0.15)',
                    border: '1px solid rgba(250, 140, 22, 0.3)',
                    borderRadius: '6px',
                    color: '#fa8c16',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(250, 140, 22, 0.25)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(250, 140, 22, 0.15)'
                  }}
                >
                  执行
                </button>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  style={{
                    padding: '6px 14px',
                    background: 'rgba(255, 77, 79, 0.15)',
                    border: '1px solid rgba(255, 77, 79, 0.3)',
                    borderRadius: '6px',
                    color: '#ff4d4f',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 77, 79, 0.25)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 77, 79, 0.15)'
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {workspaceSchedules.length === 0 && !showForm && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'rgba(255,255,255,0.25)',
          background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.4) 0%, rgba(20, 20, 35, 0.5) 100%)',
          borderRadius: '14px',
          border: '1px dashed rgba(255,255,255,0.06)'
        }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏰</div>
          <div style={{ fontSize: '14px', marginBottom: '6px' }}>暂无定时任务</div>
          <div style={{ fontSize: '12px' }}>创建一个定时任务来自动化执行工作流</div>
        </div>
      )}
    </div>
  )
}