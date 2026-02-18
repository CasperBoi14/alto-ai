import { useState, useEffect, useRef, useCallback } from 'react'
import { openLogStream } from '../api/client'

// Colour per log level
const LEVEL_STYLE = {
  DEBUG: { color: '#6b7280' },   // dim grey
  INFO:  { color: '#d1d5db' },   // light grey
  WARN:  { color: '#fbbf24' },   // yellow
  WARNING: { color: '#fbbf24' }, // yellow (alternate spelling)
  ERROR: { color: '#f87171' },   // red
}

const MAX_LINES = 500   // cap displayed lines to avoid memory bloat

function formatLine(raw) {
  try {
    const entry = JSON.parse(raw)
    const ts = new Date(entry.ts).toLocaleTimeString()
    const level = (entry.level || 'INFO').toUpperCase().padEnd(7)
    const logger = entry.logger ? `[${entry.logger}] ` : ''
    return {
      key: `${entry.ts}-${Math.random()}`,
      display: `${ts}  ${level}  ${logger}${entry.msg}${entry.exc ? '\n' + entry.exc : ''}`,
      level: entry.level || 'INFO',
    }
  } catch {
    // Not JSON — display raw (e.g. startup output before logging is configured)
    return {
      key: `${Date.now()}-${Math.random()}`,
      display: raw,
      level: 'INFO',
    }
  }
}

export default function Logs() {
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('connecting') // 'connecting' | 'connected' | 'reconnecting'
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef(null)
  const sourceRef = useRef(null)
  const reconnectTimer = useRef(null)
  const reconnectDelay = useRef(2000)

  const appendLine = useCallback((raw) => {
    const line = formatLine(raw)
    setLines(prev => {
      const next = [...prev, line]
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next
    })
  }, [])

  const connect = useCallback(async () => {
    if (sourceRef.current) {
      sourceRef.current.close()
    }

    setStatus('connecting')

    try {
      const source = await openLogStream()
      sourceRef.current = source

      source.onopen = () => {
        setStatus('connected')
        reconnectDelay.current = 2000  // reset backoff on success
      }

      source.onmessage = (e) => {
        if (e.data && e.data !== ': keepalive') {
          appendLine(e.data)
        }
      }

      source.onerror = () => {
        setStatus('reconnecting')
        source.close()
        sourceRef.current = null

        // Exponential backoff: 2s → 4s → 8s → 16s → 30s max
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000)
          connect()
        }, reconnectDelay.current)
      }
    } catch (err) {
      setStatus('reconnecting')
      reconnectTimer.current = setTimeout(connect, reconnectDelay.current)
    }
  }, [appendLine])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect()
    return () => {
      if (sourceRef.current) sourceRef.current.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' })
    }
  }, [lines, autoScroll])

  // Detect manual scroll up — disable auto-scroll
  function handleScroll(e) {
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  function clearDisplay() {
    setLines([])
  }

  // Status indicator colour
  const statusColor = status === 'connected'
    ? '#4ade80'
    : status === 'reconnecting'
    ? '#fbbf24'
    : '#6b7280'

  const statusLabel = {
    connecting: 'Connecting...',
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
  }[status]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0f1117',
      color: '#d1d5db',
      fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
    }}>

      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid #1f2937',
        background: '#111827',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#f9fafb' }}>
          Alto — Live Logs
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Connection status */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
              boxShadow: `0 0 6px ${statusColor}`,
            }} />
            {statusLabel}
          </span>

          {/* Line count */}
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {lines.length} lines
          </span>

          {/* Auto-scroll indicator */}
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true)
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              style={{
                background: '#1d4ed8',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ↓ Jump to bottom
            </button>
          )}

          {/* Clear button */}
          <button
            onClick={clearDisplay}
            style={{
              background: 'transparent',
              color: '#6b7280',
              border: '1px solid #374151',
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log output */}
      <div
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
        }}
      >
        {lines.length === 0 && (
          <div style={{ color: '#4b5563', fontSize: 13, marginTop: 8 }}>
            {status === 'connected'
              ? 'No log lines yet. Waiting for output...'
              : 'Connecting to log stream...'}
          </div>
        )}

        {lines.map(line => (
          <div
            key={line.key}
            style={{
              fontSize: 12,
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              ...(LEVEL_STYLE[line.level] || LEVEL_STYLE.INFO),
            }}
          >
            {line.display}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
