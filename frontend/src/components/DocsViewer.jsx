import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 图标组件
const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const ChevronIcon = ({ isOpen }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
  >
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

// 目录树节点组件
function TreeNode({ node, level, selectedPath, onSelect, expandedNodes, onToggle }) {
  const isDirectory = node.type === 'directory';
  const isExpanded = expandedNodes.includes(node.path);
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <div
        onClick={() => {
          if (isDirectory) {
            onToggle(node.path);
          } else {
            onSelect(node.path);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          paddingLeft: `${12 + level * 16}px`,
          cursor: 'pointer',
          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
          color: isSelected ? '#818cf8' : 'rgba(255, 255, 255, 0.7)',
          borderRadius: '6px',
          margin: '2px 8px',
          transition: 'all 0.15s ease',
          fontSize: '13px',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
          }
        }}
      >
        {isDirectory && <ChevronIcon isOpen={isExpanded} />}
        {isDirectory ? <FolderIcon /> : <FileIcon />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name.replace('.md', '')}
        </span>
      </div>
      {isDirectory && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocsViewer() {
  const [docTree, setDocTree] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docContent, setDocContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 加载文档树
  useEffect(() => {
    fetchDocTree();
  }, []);

  const fetchDocTree = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/docs/tree');
      if (!res.ok) throw new Error('加载文档目录失败');
      const data = await res.json();
      setDocTree(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 加载文档内容
  const loadDoc = useCallback(async (path) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/docs/content?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error('加载文档失败');
      const data = await res.json();
      setDocContent(data);
      setSelectedDoc(path);
    } catch (err) {
      setError(err.message);
      setDocContent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 切换目录展开/折叠
  const toggleNode = useCallback((path) => {
    setExpandedNodes(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  }, []);

  // 搜索文档
  const searchDocs = useCallback(async (query) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const res = await fetch(`/api/docs/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('搜索失败');
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchDocs(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchDocs]);

  // 返回根目录
  const goHome = () => {
    setSelectedDoc(null);
    setDocContent(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      background: '#0f0f1a',
      color: '#e8e8e8',
      position: 'relative'
    }}>
      {/* 展开按钮 - 侧边栏收起时显示 */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            padding: '8px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '8px',
            color: '#818cf8',
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      )}

      {/* 侧边栏 */}
      <div style={{
        width: sidebarOpen ? '280px' : '0',
        minWidth: sidebarOpen ? '280px' : '0',
        borderRight: sidebarOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        overflow: 'hidden'
      }}>
        {/* 侧边栏头部 */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <button
              onClick={goHome}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '8px',
                color: '#818cf8',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
              }}
            >
              <HomeIcon />
              AgentResult
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {sidebarOpen ? (
                  <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/>
                ) : (
                  <path d="M4 12h16M13 6l7 6-7 6"/>
                )}
              </svg>
            </button>
          </div>

          {/* 搜索框 */}
          <div style={{ position: 'relative' }}>
            <SearchIcon />
            <input
              type="text"
              placeholder="搜索文档..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e8e8e8',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* 目录树 / 搜索结果 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0'
        }}>
          {loading ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              加载中...
            </div>
          ) : error && docTree.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(255, 100, 100, 0.8)'
            }}>
              {error}
              <br />
              <small style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                请确保 backend/docs 目录存在并包含 .md 文件
              </small>
            </div>
          ) : isSearching ? (
            <div style={{ padding: '8px' }}>
              <div style={{
                padding: '8px 12px',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '12px'
              }}>
                搜索中...
              </div>
            </div>
          ) : searchQuery && searchResults.length > 0 ? (
            <div>
              <div style={{
                padding: '8px 12px',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '12px'
              }}>
                找到 {searchResults.length} 个结果
              </div>
              {searchResults.map((result, index) => (
                <div
                  key={`${result.path}-${index}`}
                  onClick={() => {
                    setSearchQuery('');
                    loadDoc(result.path);
                  }}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#818cf8',
                    fontSize: '13px',
                    marginBottom: '4px'
                  }}>
                    <FileIcon />
                    {result.name.replace('.md', '')}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.4)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {result.snippet}
                  </div>
                </div>
              ))}
            </div>
          ) : searchQuery && searchResults.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              未找到相关文档
            </div>
          ) : (
            docTree.map((node, index) => (
              <TreeNode
                key={`${node.path}-${index}`}
                node={node}
                level={0}
                selectedPath={selectedDoc}
                onSelect={loadDoc}
                expandedNodes={expandedNodes}
                onToggle={toggleNode}
              />
            ))
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {!docContent ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '16px', opacity: 0.3 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>选择左侧文档开始阅读</div>
            <div style={{ fontSize: '13px', opacity: 0.6 }}>
              支持 Markdown 语法渲染
            </div>
          </div>
        ) : (
          <>
            {/* 文档头部 */}
            <div style={{
              padding: '20px 32px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <FileIcon />
                <h1 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#e8e8e8'
                }}>
                  {docContent.name.replace('.md', '')}
                </h1>
              </div>
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.4)'
              }}>
                {docContent.path} • {Math.round(docContent.size / 1024)}KB • 最后修改: {new Date(docContent.lastModified).toLocaleString('zh-CN')}
              </div>
            </div>

            {/* 文档内容 */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '32px'
            }}>
              <div className="markdown-content" style={{
                maxWidth: '800px',
                margin: '0 auto',
                lineHeight: '1.7',
                fontSize: '15px'
              }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 style={{
                        fontSize: '2em',
                        fontWeight: '700',
                        marginTop: '1.5em',
                        marginBottom: '0.8em',
                        paddingBottom: '0.3em',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f1f5f9'
                      }}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 style={{
                        fontSize: '1.5em',
                        fontWeight: '600',
                        marginTop: '1.4em',
                        marginBottom: '0.6em',
                        color: '#e2e8f0'
                      }}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 style={{
                        fontSize: '1.25em',
                        fontWeight: '600',
                        marginTop: '1.2em',
                        marginBottom: '0.5em',
                        color: '#cbd5e1'
                      }}>
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 style={{
                        fontSize: '1.1em',
                        fontWeight: '600',
                        marginTop: '1em',
                        marginBottom: '0.4em',
                        color: '#94a3b8'
                      }}>
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p style={{
                        marginTop: '0',
                        marginBottom: '1em',
                        color: 'rgba(255, 255, 255, 0.85)'
                      }}>
                        {children}
                      </p>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#818cf8',
                          textDecoration: 'none',
                          borderBottom: '1px solid rgba(129, 140, 248, 0.3)',
                          transition: 'border-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#818cf8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.3)';
                        }}
                      >
                        {children}
                      </a>
                    ),
                    code: ({ inline, className, children }) => {
                      if (inline) {
                        return (
                          <code style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
                            fontSize: '0.9em',
                            color: '#a5b4fc'
                          }}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className={className} style={{
                          display: 'block',
                          background: '#1e1e2e',
                          padding: '16px',
                          borderRadius: '8px',
                          overflow: 'auto',
                          fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          margin: '1em 0',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre style={{
                        margin: '1em 0',
                        padding: '0',
                        background: 'transparent',
                        overflow: 'hidden'
                      }}>
                        {children}
                      </pre>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote style={{
                        margin: '1em 0',
                        padding: '12px 20px',
                        borderLeft: '4px solid #818cf8',
                        background: 'rgba(99, 102, 241, 0.08)',
                        borderRadius: '0 8px 8px 0',
                        color: 'rgba(255, 255, 255, 0.8)'
                      }}>
                        {children}
                      </blockquote>
                    ),
                    ul: ({ children }) => (
                      <ul style={{
                        margin: '1em 0',
                        paddingLeft: '24px',
                        color: 'rgba(255, 255, 255, 0.85)'
                      }}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol style={{
                        margin: '1em 0',
                        paddingLeft: '24px',
                        color: 'rgba(255, 255, 255, 0.85)'
                      }}>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li style={{
                        marginBottom: '0.5em'
                      }}>
                        {children}
                      </li>
                    ),
                    table: ({ children }) => (
                      <div style={{ overflow: 'auto', margin: '1em 0' }}>
                        <table style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '14px'
                        }}>
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th style={{
                        padding: '10px 12px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        borderBottom: '2px solid rgba(99, 102, 241, 0.3)',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: '#e2e8f0'
                      }}>
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        color: 'rgba(255, 255, 255, 0.8)'
                      }}>
                        {children}
                      </td>
                    ),
                    hr: () => (
                      <hr style={{
                        margin: '2em 0',
                        border: 'none',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                      }} />
                    ),
                    img: ({ src, alt }) => (
                      <img
                        src={src}
                        alt={alt}
                        style={{
                          maxWidth: '100%',
                          borderRadius: '8px',
                          margin: '1em 0'
                        }}
                      />
                    ),
                    input: ({ type, checked }) => {
                      if (type === 'checkbox') {
                        return (
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            style={{
                              marginRight: '8px',
                              accentColor: '#818cf8'
                            }}
                          />
                        );
                      }
                      return null;
                    }
                  }}
                >
                  {docContent.content}
                </ReactMarkdown>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 全局样式 */}
      <style>{`
        .markdown-content tr:nth-child(even) {
          background: rgba(255, 255, 255, 0.02);
        }
        .markdown-content ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .markdown-content ::-webkit-scrollbar-track {
          background: transparent;
        }
        .markdown-content ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .markdown-content ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
