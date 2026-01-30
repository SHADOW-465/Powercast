"use client"

import { useState } from "react"
import { NeuCard } from "@/components/ui/neu-card"
import { NeuButton } from "@/components/ui/neu-button"
import { 
  Server, 
  Plug, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Shield,
  Clock,
  Wifi,
  WifiOff,
  Settings2,
  Eye,
  EyeOff
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"

interface ScadaConfig {
  endpoint: string
  port: number
  securityMode: "None" | "Sign" | "SignAndEncrypt"
  securityPolicy: "None" | "Basic256" | "Basic256Sha256"
  username: string
  password: string
  pollingInterval: number // seconds
}

interface ScadaStatus {
  connected: boolean
  lastPoll: string | null
  nodeCount: number
  error: string | null
}

const DEFAULT_CONFIG: ScadaConfig = {
  endpoint: "opc.tcp://localhost",
  port: 4840,
  securityMode: "None",
  securityPolicy: "None",
  username: "",
  password: "",
  pollingInterval: 30,
}

export function ScadaConnector() {
  const [config, setConfig] = useState<ScadaConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<ScadaStatus>({
    connected: false,
    lastPoll: null,
    nodeCount: 0,
    error: null,
  })
  const [isTesting, setIsTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleTestConnection = async () => {
    setIsTesting(true)
    setStatus(prev => ({ ...prev, error: null }))
    
    // Simulate connection test (in production, this would call a backend API)
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Mock response - in production, call /api/scada/test
    const success = config.endpoint.includes("localhost") || config.endpoint.includes("192.168")
    
    if (success) {
      setStatus({
        connected: true,
        lastPoll: new Date().toISOString(),
        nodeCount: Math.floor(Math.random() * 50) + 10,
        error: null,
      })
      toast.success("SCADA connection successful!")
    } else {
      setStatus({
        connected: false,
        lastPoll: null,
        nodeCount: 0,
        error: "Connection refused. Check endpoint and credentials.",
      })
      toast.error("Connection failed")
    }
    
    setIsTesting(false)
  }

  const handleSaveConfig = () => {
    // In production, save to backend/database
    localStorage.setItem("scada-config", JSON.stringify(config))
    toast.success("SCADA configuration saved")
  }

  const updateConfig = (updates: Partial<ScadaConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  return (
    <NeuCard variant="flat" padding="md">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="font-bold text-[var(--text-primary)]">SCADA / OPC UA Connector</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              status.connected 
                ? "bg-[var(--accent-success)]/10 text-[var(--accent-success)]"
                : "bg-[var(--text-muted)]/10 text-[var(--text-muted)]"
            )}>
              {status.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {status.connected ? "Connected" : "Disconnected"}
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
            >
              <Settings2 className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        {/* Connection Status Summary */}
        {status.connected && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-[var(--background-secondary)]">
              <p className="text-[var(--text-muted)]">Nodes</p>
              <p className="font-semibold text-[var(--text-primary)]">{status.nodeCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--background-secondary)]">
              <p className="text-[var(--text-muted)]">Polling</p>
              <p className="font-semibold text-[var(--text-primary)]">{config.pollingInterval}s</p>
            </div>
            <div className="p-2 rounded-lg bg-[var(--background-secondary)]">
              <p className="text-[var(--text-muted)]">Last Poll</p>
              <p className="font-semibold text-[var(--text-primary)]">
                {status.lastPoll 
                  ? new Date(status.lastPoll).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : "—"
                }
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {status.error && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--accent-danger)]/10 text-xs text-[var(--accent-danger)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{status.error}</span>
          </div>
        )}

        {/* Expanded Configuration */}
        <div className={cn(
          "grid transition-all duration-300 ease-in-out overflow-hidden",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="min-h-0 space-y-3 pt-2 border-t border-[var(--border-default)]">
            {/* Endpoint Configuration */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-[var(--text-muted)]">OPC UA Endpoint</label>
                <input
                  type="text"
                  value={config.endpoint}
                  onChange={(e) => updateConfig({ endpoint: e.target.value })}
                  placeholder="opc.tcp://192.168.1.100"
                  className="w-full px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] bg-transparent focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-muted)]">Port</label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => updateConfig({ port: parseInt(e.target.value) || 4840 })}
                  className="w-full px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] bg-transparent focus:outline-none"
                />
              </div>
            </div>

            {/* Security Configuration */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Security Mode
                </label>
                <select
                  value={config.securityMode}
                  onChange={(e) => updateConfig({ securityMode: e.target.value as ScadaConfig["securityMode"] })}
                  className="w-full px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] bg-transparent focus:outline-none"
                >
                  <option value="None">None</option>
                  <option value="Sign">Sign</option>
                  <option value="SignAndEncrypt">Sign & Encrypt</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-muted)]">Security Policy</label>
                <select
                  value={config.securityPolicy}
                  onChange={(e) => updateConfig({ securityPolicy: e.target.value as ScadaConfig["securityPolicy"] })}
                  className="w-full px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] bg-transparent focus:outline-none"
                >
                  <option value="None">None</option>
                  <option value="Basic256">Basic256</option>
                  <option value="Basic256Sha256">Basic256Sha256</option>
                </select>
              </div>
            </div>

            {/* Authentication */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-muted)]">Username (optional)</label>
                <input
                  type="text"
                  value={config.username}
                  onChange={(e) => updateConfig({ username: e.target.value })}
                  placeholder="admin"
                  className="w-full px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] bg-transparent focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--text-muted)]">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={config.password}
                    onChange={(e) => updateConfig({ password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-8 neu-inset rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Polling Interval */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="w-3 h-3" /> Polling Interval (seconds)
              </label>
              <input
                type="number"
                value={config.pollingInterval}
                onChange={(e) => updateConfig({ pollingInterval: Math.max(5, parseInt(e.target.value) || 30) })}
                min={5}
                max={300}
                className="w-full px-3 py-2 neu-inset rounded-lg text-sm text-[var(--text-primary)] bg-transparent focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <NeuButton
                variant="primary"
                size="sm"
                onClick={handleTestConnection}
                loading={isTesting}
                disabled={isTesting}
              >
                <Plug className="w-4 h-4 mr-1" />
                Test Connection
              </NeuButton>
              <NeuButton
                variant="ghost"
                size="sm"
                onClick={handleSaveConfig}
              >
                Save Config
              </NeuButton>
            </div>
          </div>
        </div>

        {/* Collapsed Quick Actions */}
        {!isExpanded && !status.connected && (
          <NeuButton
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="w-full"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Configure SCADA Connection
          </NeuButton>
        )}
      </div>
    </NeuCard>
  )
}
