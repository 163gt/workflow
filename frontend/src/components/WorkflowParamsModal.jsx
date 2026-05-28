import { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Typography } from '@douyinfe/semi-ui'
import { toast } from './Toast'

const { Text } = Typography

const styles = {
  shell: {
    display: 'grid',
    gridTemplateColumns: '0.92fr 1.08fr',
    gap: '16px',
    minHeight: '520px',
    height: 'calc(78vh - 72px)',
    minWidth: 0
  },
  card: {
    background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.94) 0%, rgba(12, 18, 30, 0.98) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 18px 40px rgba(0,0,0,0.22)'
  },
  sectionTitle: {
    color: '#f3f4f6',
    fontSize: '14px',
    fontWeight: 600
  },
  sectionDesc: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: '11px',
    lineHeight: 1.45
  },
  input: {
    width: '100%',
    background: 'rgba(15, 23, 42, 0.96)',
    color: '#e5e7eb',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px 12px',
    outline: 'none'
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    background: 'rgba(15, 23, 42, 0.96)',
    color: '#e5e7eb',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '12px',
    outline: 'none',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '12px',
    lineHeight: 1.55
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '24px',
    padding: '0 10px',
    borderRadius: '999px',
    background: 'rgba(96, 165, 250, 0.14)',
    color: '#93c5fd',
    fontSize: '11px',
    letterSpacing: '0.3px'
  }
}

function prettyJson(value) {
  return JSON.stringify(value ?? {}, null, 2)
}

function parseJsonInput(text, fallback) {
  if (!text.trim()) return fallback
  return JSON.parse(text)
}

export default function WorkflowParamsModal({
  visible,
  workflow,
  nodes,
  edges,
  onClose,
  onWorkflowUpdated,
  onExecutionFinished,
  onManualExecutionStateChange
}) {
  const [loading, setLoading] = useState(false)
  const [savingSchema, setSavingSchema] = useState(false)
  const [schemaText, setSchemaText] = useState('[]')
  const [paramSets, setParamSets] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingParamsText, setEditingParamsText] = useState('{}')
  const [selectedIds, setSelectedIds] = useState([])
  const [intervalSeconds, setIntervalSeconds] = useState('0')

  const workflowId = workflow?.id

  const selectedCount = useMemo(
    () => paramSets.filter((item) => selectedIds.includes(item.id)).length,
    [paramSets, selectedIds]
  )

  const selectedNames = useMemo(
    () => paramSets.filter((item) => selectedIds.includes(item.id)).map((item) => item.name),
    [paramSets, selectedIds]
  )

  const loadParamSets = async () => {
    if (!workflowId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/workflows/${workflowId}/param-sets`)
      const data = await res.json()
      setParamSets(Array.isArray(data) ? data : [])
      setSchemaText(prettyJson(workflow?.paramsSchema || []))
    } catch (error) {
      toast.error(`加载参数集失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      setSchemaText(prettyJson(workflow?.paramsSchema || []))
      loadParamSets()
    }
  }, [visible, workflowId])

  const resetEditor = () => {
    setEditingId(null)
    setEditingName('')
    setEditingParamsText('{}')
  }

  const startCreate = () => {
    setEditingId(null)
    setEditingName('')
    const defaults = {}
    ;(workflow?.paramsSchema || []).forEach((item) => {
      if (item?.key) {
        defaults[item.key] = item.defaultValue ?? ''
      }
    })
    setEditingParamsText(prettyJson(defaults))
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditingName(item.name || '')
    setEditingParamsText(prettyJson(item.params || {}))
  }

  const withManualLoading = async (runner) => {
    onManualExecutionStateChange?.(true)
    try {
      await runner()
    } finally {
      onManualExecutionStateChange?.(false)
    }
  }

  const saveSchema = async () => {
    if (!workflowId) return
    setSavingSchema(true)
    try {
      const parsedSchema = parseJsonInput(schemaText, [])
      if (!Array.isArray(parsedSchema)) {
        throw new Error('参数定义必须是数组')
      }

      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflow.name,
          nodes,
          edges,
          paramsSchema: parsedSchema
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '保存失败')
      }
      onWorkflowUpdated?.(data)
      setSchemaText(prettyJson(data.paramsSchema || []))
      toast.success('参数定义已保存')
    } catch (error) {
      toast.error(`保存参数定义失败: ${error.message}`)
    } finally {
      setSavingSchema(false)
    }
  }

  const saveParamSet = async () => {
    if (!workflowId) return
    try {
      const params = parseJsonInput(editingParamsText, {})
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId
        ? `/api/workflows/${workflowId}/param-sets/${editingId}`
        : `/api/workflows/${workflowId}/param-sets`

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingName || '未命名参数集',
          params
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '保存失败')
      }

      resetEditor()
      await loadParamSets()
      toast.success(editingId ? '参数集已更新' : '参数集已创建')
    } catch (error) {
      toast.error(`保存参数集失败: ${error.message}`)
    }
  }

  const deleteParamSet = async (id) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/param-sets/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '删除失败')
      }
      setSelectedIds((prev) => prev.filter((item) => item !== id))
      if (editingId === id) resetEditor()
      await loadParamSets()
      toast.success('参数集已删除')
    } catch (error) {
      toast.error(`删除参数集失败: ${error.message}`)
    }
  }

  const runSingle = async (id) => {
    await withManualLoading(async () => {
      const res = await fetch(`/api/workflows/${workflowId}/param-sets/${id}/execute`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '执行失败')
      }
      toast.success(data.status === 'success' ? '执行成功' : `执行失败: ${data.error || '未知错误'}`)
      onExecutionFinished?.(data)
    }).catch((error) => {
      toast.error(`执行失败: ${error.message}`)
    })
  }

  const runBatch = async () => {
    await withManualLoading(async () => {
      const seconds = Number(intervalSeconds || '0')
      if (selectedIds.length === 0) {
        throw new Error('请至少选择一组参数')
      }
      if (Number.isNaN(seconds) || seconds < 0) {
        throw new Error('间隔秒数必须是大于等于 0 的数字')
      }

      const res = await fetch(`/api/workflows/${workflowId}/batch-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paramSetIds: selectedIds,
          intervalSeconds: seconds
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '批量执行失败')
      }
      toast.success(`批量执行完成，共 ${data.items?.length || 0} 条`)
      onExecutionFinished?.(data)
    }).catch((error) => {
      toast.error(`批量执行失败: ${error.message}`)
    })
  }

  const runAll = async () => {
    await withManualLoading(async () => {
      const seconds = Number(intervalSeconds || '0')
      if (Number.isNaN(seconds) || seconds < 0) {
        throw new Error('间隔秒数必须是大于等于 0 的数字')
      }

      const res = await fetch(`/api/workflows/${workflowId}/execute-all-param-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervalSeconds: seconds
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '全部执行失败')
      }
      toast.success(`全部执行完成，共 ${data.items?.length || 0} 条`)
      onExecutionFinished?.(data)
    }).catch((error) => {
      toast.error(`全部执行失败: ${error.message}`)
    })
  }

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      title="流程参数与执行编排"
      width={920}
      bodyStyle={{ maxHeight: '78vh', overflow: 'hidden', padding: '20px 20px 24px' }}
      style={{ top: 18 }}
    >
      <div style={styles.shell}>
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '16px', minHeight: 0, minWidth: 0 }}>
          <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            <div style={styles.sectionTitle}>参数定义</div>
            <div style={styles.tag}>示例: [{'{'}"key":"appId","label":"App ID","defaultValue":""{'}'}]</div>
            <textarea
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              style={{ ...styles.textarea, minHeight: '0', flex: 1 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button theme="solid" type="primary" loading={savingSchema} onClick={saveSchema}>
                保存参数定义
              </Button>
            </div>
          </div>

          <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            <div style={styles.sectionTitle}>{editingId ? '编辑参数集' : '新建参数集'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ ...styles.sectionDesc, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                参数集名称
              </label>
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="例如：客户 A / 测试环境"
                style={styles.input}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0, flex: 1 }}>
              <label style={{ ...styles.sectionDesc, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                参数内容
              </label>
              <textarea
                value={editingParamsText}
                onChange={(e) => setEditingParamsText(e.target.value)}
                placeholder='{"appId":"4802333"}'
                style={{ ...styles.textarea, minHeight: '0', flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button onClick={resetEditor}>清空</Button>
              <Button type="primary" onClick={saveParamSet}>保存参数集</Button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '18px', minHeight: 0, minWidth: 0 }}>
          <div style={{ ...styles.card, display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center', padding: '14px 16px' }}>
            <div>
              <div style={styles.sectionTitle}>批量执行</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={styles.tag}>已选 {selectedCount} 组</span>
                  {selectedCount > 0 && (
                    <span style={{ ...styles.tag, background: 'rgba(52, 211, 153, 0.12)', color: '#6ee7b7' }}>
                      已加入批量执行
                    </span>
                  )}
                </div>
                {selectedCount > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '100%', alignItems: 'flex-start' }}>
                    {selectedNames.slice(0, 4).map((name) => (
                      <span
                        key={name}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          minHeight: '22px',
                          maxWidth: '160px',
                          padding: '2px 9px',
                          borderRadius: '999px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.78)',
                          fontSize: '11px',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flexShrink: 0
                        }}
                        title={name}
                      >
                        {name}
                      </span>
                    ))}
                    {selectedCount > 4 && (
                      <span style={{ ...styles.tag, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}>
                        +{selectedCount - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px', justifyContent: 'flex-end' }}>
              <input
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(e.target.value)}
                placeholder="间隔秒数"
                style={{ ...styles.input, width: '108px', padding: '8px 10px' }}
              />
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <Button onClick={runBatch} type="primary" disabled={selectedIds.length === 0}>
                  执行已选
                </Button>
                <Button onClick={runAll}>
                  执行全部
                </Button>
              </div>
            </div>
          </div>

          <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={styles.sectionTitle}>参数集列表</div>
              <span style={styles.tag}>{paramSets.length} 组</span>
            </div>

            {loading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.58)' }}>
                加载中...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto', paddingRight: '4px', minHeight: 0 }}>
                {paramSets.map((item) => {
                  const isSelected = selectedIds.includes(item.id)
                  return (
                    <div
                      key={item.id}
                      style={{
                        border: isSelected ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '14px',
                        padding: '14px',
                        background: isSelected ? 'rgba(37, 99, 235, 0.10)' : 'rgba(255,255,255,0.03)',
                        boxShadow: isSelected ? '0 0 0 1px rgba(96,165,250,0.14), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <label style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#e5e7eb', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setSelectedIds((prev) => e.target.checked
                                ? [...prev, item.id]
                                : prev.filter((id) => id !== item.id))
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.name}</div>
                            <div style={{ ...styles.sectionDesc, marginTop: '4px' }}>
                              {Object.keys(item.params || {}).length} 个参数字段
                            </div>
                          </div>
                        </label>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <Button size="small" onClick={() => runSingle(item.id)}>单独执行</Button>
                          <Button size="small" onClick={() => startEdit(item)}>编辑</Button>
                          <Button size="small" type="danger" onClick={() => deleteParamSet(item.id)}>删除</Button>
                        </div>
                      </div>

                      <pre style={{
                        margin: '12px 0 0',
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.68)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '84px',
                        overflow: 'auto',
                        padding: '8px 10px',
                        background: 'rgba(0,0,0,0.18)',
                        borderRadius: '10px'
                      }}>
                        {prettyJson(item.params)}
                      </pre>
                    </div>
                  )
                })}

                {paramSets.length === 0 && (
                  <div
                    style={{
                      flex: 1,
                      minHeight: '180px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255,255,255,0.42)',
                      border: '1px dashed rgba(255,255,255,0.12)',
                      borderRadius: '14px'
                    }}
                  >
                    <div style={{ fontSize: '14px', marginBottom: '6px' }}>暂无参数集</div>
                    <div style={{ fontSize: '12px' }}>先在左侧新建一组参数</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
