'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { Zap, Sun, Wind, Waves } from 'lucide-react';

import { fetchApi } from '@/lib/api';

export default function Dashboard() {
  const [gridStatus, setGridStatus] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initData() {
      try {
        const [status, loadForecast] = await Promise.all([
          fetchApi('/grid/status'),
          fetchApi('/forecast?target=load')
        ]);

        setGridStatus(status);

        // Transform API forecast to chart format
        const chartData = loadForecast.forecasts.map((f: any) => ({
          time: f.timestamp.split('T')[1].substring(0, 5),
          load: Math.round(f.point),
          solar: Math.round(f.q10), // Using quantiles to simulate solar/wind for visualization
          wind: Math.round(f.q90),
          netLoad: Math.round(f.point - (f.q10 + f.q90) * 0.5),
          isNow: false
        }));

        setForecastData(chartData);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      }
    }

    initData();
    const timer = setInterval(initData, 15000); // Update every 15s
    return () => clearInterval(timer);
  }, []);

  if (loading || !gridStatus) return <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Loading Grid System Data...</div>;

  return (
    <div className="dashboard-grid">
      {/* Left Panel - Grid Status */}
      <div className="grid-status-panel">
        <div className="card status-card">
          <div className="status-label">Total Load</div>
          <div className="status-value">
            {gridStatus.total_load_mw.toLocaleString()} <span>MW</span>
          </div>
        </div>

        <div className="card status-card">
          <div className="status-label">Renewable Generation</div>
          <div className="status-value" style={{ color: 'var(--accent-green)' }}>
            {gridStatus.renewable_generation_mw.toLocaleString()} <span>MW</span>
          </div>
          <div className="status-breakdown">
            <div className="breakdown-item">
              <div className="breakdown-dot" style={{ background: 'var(--accent-yellow)' }} />
              <span>{gridStatus.solar_generation_mw} MW</span>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-dot" style={{ background: 'var(--accent-green)' }} />
              <span>{gridStatus.wind_generation_mw} MW</span>
            </div>
            <div className="breakdown-item">
              <div className="breakdown-dot" style={{ background: 'var(--text-muted)' }} />
              <span>Other</span>
            </div>
          </div>
        </div>

        <div className="card status-card">
          <div className="status-label">Net Load</div>
          <div className="status-value" style={{ color: 'var(--accent-orange)' }}>
            {gridStatus.net_load_mw.toLocaleString()} <span>MW</span>
          </div>
        </div>

        <div className="card status-card">
          <div className="status-label">Reserve Margin</div>
          <div className="status-value" style={{ color: 'var(--accent-cyan)' }}>
            {gridStatus.reserve_margin_mw} <span>MW</span>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="card chart-container">
        <div className="chart-header">
          <h3 className="chart-title">System Forecast Overview</h3>
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-line" style={{ background: 'var(--chart-load)' }} />
              <span>Load Forecast</span>
              <span style={{ color: 'var(--chart-load)', fontWeight: 600, marginLeft: 8 }}>8,342</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ background: 'var(--chart-solar)' }} />
              <span>Solar</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ background: 'var(--chart-wind)' }} />
              <span>Wind generation</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ background: 'var(--chart-net)', borderStyle: 'dashed' }} />
              <span>Net Load</span>
              <span style={{ color: 'var(--chart-net)', fontWeight: 600, marginLeft: 8 }}>4,451</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={forecastData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="time"
              stroke="#5a6a7a"
              fontSize={11}
              tickLine={false}
              interval={11}
            />
            <YAxis
              stroke="#5a6a7a"
              fontSize={11}
              tickLine={false}
              domain={[0, 'auto']}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px'
              }}
              labelStyle={{ color: 'var(--text-primary)' }}
            />

            <ReferenceLine
              x={forecastData[0]?.time}
              stroke="var(--accent-cyan)"
              strokeDasharray="3 3"
              label={{ value: 'NOW', position: 'top', fill: 'var(--accent-cyan)', fontSize: 11 }}
            />

            <Area
              type="monotone"
              dataKey="solar"
              fill="rgba(255, 215, 0, 0.2)"
              stroke="var(--chart-solar)"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="load"
              stroke="var(--chart-load)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="wind"
              stroke="var(--chart-wind)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="netLoad"
              stroke="var(--chart-net)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Metrics Row */}
      <div className="metrics-row">
        <div className="card metric-card">
          <div className="metric-header">Forecast Accuracy (24h)</div>
          <div className="metric-value cyan">
            MAPE<br />
            <span style={{ fontSize: 42 }}>2.8%</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">Renewable Forecast Uncertainty</div>
          <div className="status-list">
            <div className="status-row">
              <span>Solar Risk</span>
              <span className="status-badge medium">Risk</span>
            </div>
            <div className="status-row">
              <span>Wind Risk</span>
              <span className="status-badge risk">Risk</span>
            </div>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-header">Required Operating Reserves</div>
          <div className="status-list">
            <div className="status-row">
              <span>Primary Reserve</span>
              <span className="status-badge adequate">Adequate</span>
            </div>
            <div className="status-row">
              <span>Secondary Reserve</span>
              <span className="status-badge adequate">Adequate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Optimization Status */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div className="optimization-status">
          <div className="optimization-dot" />
          <span className="optimization-text">Optimization Engine</span>
          <span style={{
            marginLeft: 8,
            padding: '4px 10px',
            background: 'rgba(0, 255, 136, 0.2)',
            borderRadius: '4px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--accent-green)'
          }}>
            ● ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
