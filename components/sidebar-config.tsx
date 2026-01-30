"use client"

import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Download, RotateCw, BarChart3 } from "lucide-react"

export function SidebarConfig() {
  const { carbonWeight, portfolioFilter, timeRange, setCarbonWeight, setPortfolioFilter, setTimeRange } = useStore()

  const handleExportPDF = () => {
    // In production, generate actual PDF
    const data = {
      timestamp: new Date().toISOString(),
      carbonWeight,
      portfolioFilter,
      timeRange,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `swissflex-report-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="w-full md:w-64 bg-white border-r border-border p-6 h-screen overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg md:text-xl font-bold text-primary mb-2">SwissFlex AI</h2>
          <p className="text-xs text-muted-foreground">v1.0 • Demo Mode</p>
        </div>

        {/* Portfolio Selector */}
        <Card className="p-4">
          <label className="block text-xs md:text-sm font-semibold text-primary mb-3">Portfolio</label>
          <div className="space-y-2">
            {[
              { value: "full", label: "Full Portfolio" },
              { value: "hydro-only", label: "Hydro Only" },
              { value: "pv-only", label: "PV Only" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setPortfolioFilter(option.value as "full" | "hydro-only" | "pv-only")}
                className={`w-full px-3 py-2 rounded text-xs font-medium transition ${
                  portfolioFilter === option.value
                    ? "bg-primary text-white"
                    : "bg-muted text-foreground hover:bg-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Time Range */}
        <Card className="p-4">
          <label className="block text-xs md:text-sm font-semibold text-primary mb-3">Time Horizon</label>
          <div className="flex items-center gap-2 mb-3">
            <Slider
              value={[timeRange]}
              onValueChange={(val) => setTimeRange(val[0])}
              min={1}
              max={168}
              step={1}
              className="flex-1"
            />
            <span className="text-xs font-medium text-primary whitespace-nowrap">{timeRange}h</span>
          </div>
          <div className="flex gap-1">
            {[24, 48, 168].map((h) => (
              <button
                key={h}
                onClick={() => setTimeRange(h)}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium transition ${
                  timeRange === h ? "bg-secondary text-white" : "bg-muted text-foreground"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </Card>

        {/* Carbon Weight */}
        <Card className="p-4">
          <label className="block text-xs md:text-sm font-semibold text-primary mb-3">Carbon Weight</label>
          <Slider value={[carbonWeight]} onValueChange={(val) => setCarbonWeight(val[0])} min={0} max={100} step={5} />
          <p className="text-xs text-muted-foreground mt-2">{carbonWeight}% prioritize clean energy</p>
        </Card>

        {/* Divider */}
        <div className="border-t border-border"></div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button onClick={handleRefresh} variant="outline" className="w-full bg-transparent" size="sm">
            <RotateCw className="w-3 h-3 md:w-4 md:h-4 mr-2" />
            <span className="text-xs md:text-sm">Refresh</span>
          </Button>
          <Button onClick={handleExportPDF} variant="outline" className="w-full bg-transparent" size="sm">
            <Download className="w-3 h-3 md:w-4 md:h-4 mr-2" />
            <span className="text-xs md:text-sm">Export</span>
          </Button>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4" />
            <span>Powered by Gemini 2.0</span>
          </div>
          <p>Demo Mode • No real transactions</p>
        </div>
      </div>
    </div>
  )
}
