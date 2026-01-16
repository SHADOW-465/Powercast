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

// Simulation logic that responds to inputs
function generateForecastData(inputs: {
    temperature: number,
    cloudCover: number,
    loadOffset: number,
    volatility: number
}) {
    const data = [];
    const now = new Date();
    const baseLoad = 8000 + inputs.loadOffset;

    for (let i = 0; i < 96; i++) {
        const time = new Date(now.getTime() + i * 15 * 60 * 1000);
        const hour = time.getHours() + time.getMinutes() / 60;

        // Load depends on temperature (U-shaped: high for cooling/heating)
        const tempEffect = Math.abs(inputs.temperature - 20) * 50;

        const morningPeak = Math.exp(-Math.pow(hour - 9.5, 2) / 8) * 0.25;
        const eveningPeak = Math.exp(-Math.pow(hour - 18.5, 2) / 6) * 0.35;
        const loadFactor = 0.8 + morningPeak + eveningPeak;
        const load = (baseLoad + tempEffect) * loadFactor;

        // Generate uncertainty based on volatility input
        const uncertainty = (200 + i * 5) * (inputs.volatility / 50);

        let solar = 0;
        if (hour >= 6 && hour <= 20) {
            // Solar depends on cloud cover
            const cloudFactor = 1 - (inputs.cloudCover / 100);
            solar = 4000 * Math.sin((hour - 6) * Math.PI / 14) * cloudFactor;
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
            scenarios: Array(5).fill(0).map(() => Math.round(load + (Math.random() - 0.5) * uncertainty * 2.5))
        });
    }

    return data;
}

export default function ForecastsPage() {
    const [inputs, setInputs] = useState({
        temperature: 22,
        cloudCover: 15,
        loadOffset: 0,
        volatility: 50
    });

    const [forecastData, setForecastData] = useState<any[]>([]);
    const [showScenarios, setShowScenarios] = useState(true);
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        setForecastData(generateForecastData(inputs));
    }, [inputs]);

    const handleInputChange = (key: string, value: number) => {
        setIsSimulating(true);
        setInputs(prev => ({ ...prev, [key]: value }));
        // Brief simulation delay for UX
        setTimeout(() => setIsSimulating(false), 300);
    };

    return (
        <div className="forecast-explorer">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Forecasting & Simulations</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                        Adjust parameters below to see how the AI model predicts grid response under different conditions.
                    </p>
                </div>
                <div className="page-filters">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input
                            type="checkbox"
                            checked={showScenarios}
                            onChange={(e) => setShowScenarios(e.target.checked)}
                            style={{ accentColor: 'var(--accent-cyan)' }}
                        />
                        Show Uncertainty Bands
                    </label>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
                {/* Input Panel */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <h3 style={{ fontSize: 14, marginBottom: 20, color: 'var(--accent-cyan)' }}>Simulation Controls</h3>

                    <div className="simulation-inputs" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label style={{ fontSize: 12 }}>Surface Temperature</label>
                                <span style={{ fontSize: 12, color: 'var(--accent-cyan)' }}>{inputs.temperature}°C</span>
                            </div>
                            <input
                                type="range" min="0" max="40" step="1"
                                value={inputs.temperature}
                                onChange={(e) => handleInputChange('temperature', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                            />
                        </div>

                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label style={{ fontSize: 12 }}>Cloud Cover (%)</label>
                                <span style={{ fontSize: 12, color: 'var(--accent-yellow)' }}>{inputs.cloudCover}%</span>
                            </div>
                            <input
                                type="range" min="0" max="100" step="5"
                                value={inputs.cloudCover}
                                onChange={(e) => handleInputChange('cloudCover', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-yellow)' }}
                            />
                        </div>

                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label style={{ fontSize: 12 }}>Demand Bias (MW)</label>
                                <span style={{ fontSize: 12, color: 'var(--accent-orange)' }}>{inputs.loadOffset > 0 ? '+' : ''}{inputs.loadOffset}</span>
                            </div>
                            <input
                                type="range" min="-2000" max="2000" step="100"
                                value={inputs.loadOffset}
                                onChange={(e) => handleInputChange('loadOffset', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-orange)' }}
                            />
                        </div>

                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label style={{ fontSize: 12 }}>Forecast Volatility</label>
                                <span style={{ fontSize: 12, color: 'var(--accent-purple)' }}>{inputs.volatility}</span>
                            </div>
                            <input
                                type="range" min="10" max="200" step="10"
                                value={inputs.volatility}
                                onChange={(e) => handleInputChange('volatility', parseInt(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-purple)' }}
                            />
                        </div>

                        <button
                            onClick={() => setInputs({ temperature: 22, cloudCover: 15, loadOffset: 0, volatility: 50 })}
                            style={{
                                marginTop: 10,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                padding: '10px',
                                borderRadius: '6px',
                                fontSize: 12,
                                cursor: 'pointer'
                            }}
                        >
                            Reset to Nominal
                        </button>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="card" style={{ position: 'relative' }}>
                    {isSimulating && (
                        <div style={{
                            position: 'absolute',
                            top: 20,
                            right: 20,
                            fontSize: 11,
                            color: 'var(--accent-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            zIndex: 10
                        }}>
                            <div className="live-dot" /> Running MC Inference...
                        </div>
                    )}

                    <div className="chart-header">
                        <div className="chart-legend">
                            <div className="legend-item">
                                <div className="legend-line" style={{ background: 'var(--chart-load)' }} />
                                <span>Load Prediction</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-line" style={{ background: 'var(--chart-solar)' }} />
                                <span>PV Potential</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-line" style={{ background: 'rgba(0, 212, 255, 0.3)', height: 8 }} />
                                <span>Confidence Band</span>
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
                                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k MW`}
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

                            {showScenarios && (
                                <Area
                                    type="monotone"
                                    dataKey="loadUpper"
                                    stroke="none"
                                    fill="rgba(0, 212, 255, 0.1)"
                                />
                            )}

                            <Area
                                type="monotone"
                                dataKey="solar"
                                fill="rgba(255, 215, 0, 0.15)"
                                stroke="var(--chart-solar)"
                                strokeWidth={2}
                            />

                            {/* Monte Carlo scenario lines */}
                            {showScenarios && forecastData[0]?.scenarios.map((_, idx) => (
                                <Line
                                    key={idx}
                                    type="monotone"
                                    dataKey={`scenarios[${idx}]`}
                                    stroke="rgba(0, 212, 255, 0.2)"
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
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 24 }}>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Effective Peak</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{Math.max(...forecastData.map(d => d.load)).toLocaleString()} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>MW</span></div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Solar Yield</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-yellow)' }}>{Math.max(...forecastData.map(d => d.solar)).toLocaleString()} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>MW</span></div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Demand Variance</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-cyan)' }}>±{(inputs.volatility * 10).toLocaleString()} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>MW</span></div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Grid Health</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-green)' }}>EXCELLENT</div>
                </div>
            </div>
        </div>
    );
}
