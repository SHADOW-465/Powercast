"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Bot, User, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { NeuButton } from "@/components/ui/neu-button"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if API is configured on mount
  useEffect(() => {
    checkApiStatus()
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const checkApiStatus = async () => {
    try {
      const response = await fetch("/api/chat")
      const data = await response.json()
      setApiConfigured(data.apiConfigured)
    } catch {
      setApiConfigured(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setError(null)
    
    // Add user message
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMessage }]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-10) // Send last 10 messages for context
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 503) {
          setApiConfigured(false)
          setError("API key is not set for chat assistant")
        } else {
          setError(data.message || "Failed to get response")
        }
        return
      }

      // Add assistant response
      setMessages([...newMessages, { role: "assistant", content: data.response }])
    } catch (err) {
      setError("Failed to connect to chat service")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300",
          "bg-[var(--accent-primary)] hover:scale-110 active:scale-95",
          isOpen && "rotate-90"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[500px] flex flex-col neu-raised rounded-2xl overflow-hidden bg-[var(--surface)] shadow-2xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-[var(--border-default)] bg-[var(--background)]">
            <div className="p-2 rounded-xl bg-[var(--accent-primary)]/10">
              <Bot className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--text-primary)] text-sm">Powercast Assistant</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {apiConfigured === false ? "API not configured" : "Ask about forecasting & optimization"}
              </p>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[320px]">
            {/* API Not Configured Warning */}
            {apiConfigured === false && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--accent-warning)]/10">
                <AlertCircle className="w-4 h-4 text-[var(--accent-warning)] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[var(--text-secondary)]">
                  API key is not set for chat assistant. Please configure <code className="px-1 py-0.5 rounded bg-[var(--background)] text-[10px]">GEMINI_API_KEY</code> in your environment variables.
                </p>
              </div>
            )}

            {/* Welcome Message */}
            {messages.length === 0 && apiConfigured !== false && (
              <div className="text-center py-6">
                <Bot className="w-10 h-10 mx-auto mb-3 text-[var(--accent-primary)]" />
                <p className="text-sm text-[var(--text-primary)] font-medium">Hi! I'm your Powercast Assistant</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Ask me about forecasting, optimization, or power plant operations.</p>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 h-fit">
                    <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] p-3 rounded-xl text-sm",
                    msg.role === "user"
                      ? "bg-[var(--accent-primary)] text-white"
                      : "neu-flat text-[var(--text-primary)]"
                  )}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 h-fit">
                    <User className="w-4 h-4 text-[var(--accent-primary)]" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 h-fit">
                  <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
                </div>
                <div className="neu-flat p-3 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--accent-danger)]/10">
                <AlertCircle className="w-4 h-4 text-[var(--accent-danger)] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[var(--text-secondary)]">{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-[var(--border-default)] bg-[var(--background)]">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={apiConfigured === false ? "API key required..." : "Ask a question..."}
                disabled={apiConfigured === false || isLoading}
                className="flex-1 px-3 py-2 neu-inset rounded-xl text-sm text-[var(--text-primary)] 
                           placeholder:text-[var(--text-subtle)] bg-transparent
                           focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || apiConfigured === false}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  input.trim() && !isLoading && apiConfigured !== false
                    ? "bg-[var(--accent-primary)] text-white hover:scale-105"
                    : "neu-flat text-[var(--text-muted)]"
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
