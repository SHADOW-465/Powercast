'use client';

import { Calendar } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

// Generate historical accuracy data
const accuracyData = Array(30).fill(0).map((_, i) => ({
    date: `Jan ${i + 1}`,
    mape: 2.5 + Math.random() * 1.5,
    coverage: 93 + Math.random() * 4
}));

export default function HistoricalPage() {
    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Historical Performance</h1>
                <div className="page-filters">
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(255,255,255,0.05)',
                        padding: '8px 16px',
                        borderRadius: 8
                    }}>
                        <Calendar size={16} />
                        <span style={{ fontSize: 13 }}>Last 30 days</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Avg MAPE (30d)</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-cyan)' }}>2.8%</div>
                    <div style={{ fontSize: 12, color: 'var(--accent-green)', marginTop: 4 }}>↓ 0.4% vs prev period</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Coverage Rate</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-green)' }}>94.8%</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Target: 95%</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Forecasts Generated</div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>43,200</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>1,440/day</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Est. Savings</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-green)' }}>CHF 4.2M</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>vs baseline system</div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 20, fontSize: 14 }}>Forecast Accuracy Trend (MAPE %)</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={accuracyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="#5a6a7a" fontSize={11} />
                        <YAxis stroke="#5a6a7a" fontSize={11} domain={[0, 5]} />
                        <Tooltip
                            contentStyle={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px'
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="mape"
                            stroke="var(--accent-cyan)"
                            strokeWidth={2}
                            dot={{ fill: 'var(--accent-cyan)', r: 3 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: 20, fontSize: 14 }}>Coverage Rate Trend (%)</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={accuracyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" stroke="#5a6a7a" fontSize={11} />
                        <YAxis stroke="#5a6a7a" fontSize={11} domain={[90, 100]} />
                        <Tooltip
                            contentStyle={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px'
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="coverage"
                            stroke="var(--accent-green)"
                            strokeWidth={2}
                            dot={{ fill: 'var(--accent-green)', r: 3 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
