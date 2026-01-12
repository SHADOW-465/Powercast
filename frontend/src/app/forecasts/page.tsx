'use client';

import { useState } from 'react';
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

// Generate forecast data with Monte Carlo scenarios
function generateForecastData() {
    const data = [];
    const now = new Date();
    const baseLoad = 8000;

    for (let i = 0; i < 96; i++) {
        const time = new Date(now.getTime() + i * 15 * 60 * 1000);
        const hour = time.getHours() + time.getMinutes() / 60;

        const morningPeak = Math.exp(-Math.pow(hour - 9.5, 2) / 8) * 0.25;
        const eveningPeak = Math.exp(-Math.pow(hour - 18.5, 2) / 6) * 0.35;
        const loadFactor = 0.8 + morningPeak + eveningPeak;
        const load = baseLoad * loadFactor;

        // Generate scenario bands
        const uncertainty = 200 + i * 5;

        let solar = 0;
        if (hour >= 6 && hour <= 20) {
            solar = 4000 * Math.sin((hour - 6) * Math.PI / 14);
        }

        const wind = 800 + Math.sin(i * 0.2) * 300;

        data.push({
            time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
            load: Math.round(load),
            loadUpper: Math.round(load + uncertainty),
            loadLower: Math.round(load - uncertainty),
            solar: Math.round(solar),
            wind: Math.round(wind),
            netLoad: Math.round(load - solar - wind),
            scenarios: Array(5).fill(0).map(() => Math.round(load + (Math.random() - 0.5) * uncertainty * 2))
        });
    }

    return data;
}

export default function ForecastsPage() {
    const [forecastData] = useState(generateForecastData());
    const [showScenarios, setShowScenarios] = useState(true);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">System Forecast Overview - Forecast Explorer - Load Scenarios</h1>
                <div className="page-filters">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input
                            type="checkbox"
                            checked={showScenarios}
                            onChange={(e) => setShowScenarios(e.target.checked)}
                            style={{ accentColor: 'var(--accent-cyan)' }}
                        />
                        Show Monte Carlo Scenarios
                    </label>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="chart-header">
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
                            <div className="legend-line" style={{ background: 'rgba(0, 212, 255, 0.3)', height: 8 }} />
                            <span>Monte Carlo Scenarios</span>
                        </div>
                    </div>
                </div>

                <ResponsiveContainer width="100%" height={400}>
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
                        />

                        <ReferenceLine
                            x={forecastData[0]?.time}
                            stroke="var(--accent-cyan)"
                            strokeDasharray="3 3"
                            label={{ value: 'NOW', position: 'top', fill: 'var(--accent-cyan)', fontSize: 11 }}
                        />

                        {/* Scenario band */}
                        {showScenarios && (
                            <Area
                                type="monotone"
                                dataKey="loadUpper"
                                stroke="none"
                                fill="rgba(0, 212, 255, 0.15)"
                            />
                        )}

                        <Area
                            type="monotone"
                            dataKey="solar"
                            fill="rgba(255, 215, 0, 0.2)"
                            stroke="var(--chart-solar)"
                            strokeWidth={2}
                        />

                        {/* Monte Carlo scenario lines */}
                        {showScenarios && forecastData[0]?.scenarios.map((_, idx) => (
                            <Line
                                key={idx}
                                type="monotone"
                                dataKey={`scenarios[${idx}]`}
                                stroke="rgba(0, 212, 255, 0.3)"
                                strokeWidth={1}
                                dot={false}
                            />
                        ))}

                        <Line
                            type="monotone"
                            dataKey="load"
                            stroke="var(--chart-load)"
                            strokeWidth={3}
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="wind"
                            stroke="var(--chart-wind)"
                            strokeWidth={2}
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Peak Load</div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>9,234 <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>MW</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>at 18:45</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Min Load</div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>6,892 <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>MW</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>at 04:15</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Peak Solar</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-yellow)' }}>3,850 <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>MW</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>at 12:30</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Uncertainty Band</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-cyan)' }}>±680 <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>MW</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>95% confidence</div>
                </div>
            </div>
        </div>
    );
}
