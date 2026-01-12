'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api';

export default function ScenariosPage() {
    const [scenarios, setScenarios] = useState<number[][]>([]);
    const [percentiles, setPercentiles] = useState<{ p10: number[], p50: number[], p90: number[] }>({ p10: [], p50: [], p90: [] });
    const [strategy, setStrategy] = useState('expected');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadScenarios() {
            try {
                const data = await fetchApi('/scenarios/');
                const paths = data.scenarios.map((s: any) => s.path);
                setScenarios(paths);

                // Calculate percentiles from paths
                const p10: number[] = [];
                const p50: number[] = [];
                const p90: number[] = [];
                for (let t = 0; t < 96; t++) {
                    const values = paths.map((p: number[]) => p[t]).sort((a: number, b: number) => a - b);
                    if (values.length > 0) {
                        p10.push(values[Math.floor(values.length * 0.1)]);
                        p50.push(values[Math.floor(values.length * 0.5)]);
                        p90.push(values[Math.floor(values.length * 0.9)]);
                    }
                }
                setPercentiles({ p10, p50, p90 });
                setLoading(false);
            } catch (err) {
                console.error("Failed to load scenarios", err);
            }
        }
        loadScenarios();
    }, []);

    const stats = scenarios.length > 0 ? {
        meanLoad: Math.round(scenarios.flat().reduce((a, b) => a + b, 0) / (scenarios.flat().length || 1)),
        maxPeak: Math.max(...scenarios.flat()),
        minLoad: Math.min(...scenarios.flat())
    } : { meanLoad: 0, maxPeak: 0, minLoad: 0 };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Scenario Analysis - Monte Carlo Explorer</h1>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 16, fontSize: 14 }}>Probability Distribution Heatmap</h3>

                <div style={{
                    position: 'relative',
                    height: 350,
                    background: 'linear-gradient(180deg, rgba(10,22,40,0.95) 0%, rgba(0,212,255,0.3) 30%, rgba(255,215,0,0.5) 50%, rgba(255,140,0,0.4) 70%, rgba(255,68,68,0.2) 100%)',
                    borderRadius: 12,
                    overflow: 'hidden'
                }}>
                    {/* Y-axis labels */}
                    <div style={{ position: 'absolute', left: 10, top: 10, fontSize: 11, color: 'var(--text-muted)' }}>10,000</div>
                    <div style={{ position: 'absolute', left: 10, top: '25%', fontSize: 11, color: 'var(--text-muted)' }}>8,000</div>
                    <div style={{ position: 'absolute', left: 10, top: '50%', fontSize: 11, color: 'var(--text-muted)' }}>6,000</div>
                    <div style={{ position: 'absolute', left: 10, top: '75%', fontSize: 11, color: 'var(--text-muted)' }}>4,000</div>
                    <div style={{ position: 'absolute', left: 10, bottom: 30, fontSize: 11, color: 'var(--text-muted)' }}>2,000</div>

                    {/* Y-axis unit */}
                    <div style={{
                        position: 'absolute',
                        left: -20,
                        top: '50%',
                        transform: 'rotate(-90deg)',
                        fontSize: 11,
                        color: 'var(--text-muted)'
                    }}>
                        Power (MW)
                    </div>

                    {/* X-axis labels */}
                    <div style={{ position: 'absolute', left: 60, bottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>00:00</div>
                    <div style={{ position: 'absolute', left: '25%', bottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>06:00</div>
                    <div style={{ position: 'absolute', left: '50%', bottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>12:00</div>
                    <div style={{ position: 'absolute', left: '75%', bottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>18:00</div>
                    <div style={{ position: 'absolute', right: 20, bottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>24:00</div>

                    {/* Percentile lines */}
                    <svg style={{ position: 'absolute', left: 60, right: 20, top: 30, bottom: 40, width: 'calc(100% - 80px)', height: 'calc(100% - 70px)' }}>
                        {percentiles.p50.length > 0 && (
                            <>
                                {/* P90 line */}
                                <polyline
                                    fill="none"
                                    stroke="rgba(255,255,255,0.5)"
                                    strokeWidth="2"
                                    strokeDasharray="4 4"
                                    points={percentiles.p90.map((v, i) =>
                                        `${(i / 95) * 100}%,${100 - ((v - 2000) / 8000) * 100}%`
                                    ).join(' ')}
                                />
                                {/* P50 line */}
                                <polyline
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="3"
                                    points={percentiles.p50.map((v, i) =>
                                        `${(i / 95) * 100}%,${100 - ((v - 2000) / 8000) * 100}%`
                                    ).join(' ')}
                                />
                                {/* P10 line */}
                                <polyline
                                    fill="none"
                                    stroke="rgba(255,255,255,0.5)"
                                    strokeWidth="2"
                                    strokeDasharray="4 4"
                                    points={percentiles.p10.map((v, i) =>
                                        `${(i / 95) * 100}%,${100 - ((v - 2000) / 8000) * 100}%`
                                    ).join(' ')}
                                />
                            </>
                        )}
                    </svg>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <div style={{ width: 24, height: 3, background: 'white' }} />
                        P50
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <div style={{ width: 24, height: 2, background: 'rgba(255,255,255,0.5)', borderTop: '2px dashed rgba(255,255,255,0.5)' }} />
                        P10
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <div style={{ width: 24, height: 2, background: 'rgba(255,255,255,0.5)', borderTop: '2px dashed rgba(255,255,255,0.5)' }} />
                        P90
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Scenario Stats */}
                <div className="card">
                    <h3 style={{ marginBottom: 20, fontSize: 14 }}>Scenario Set Statistics</h3>
                    <div className="scenario-stats">
                        <div className="stat-item">
                            <div className="stat-label">Total Scenarios</div>
                            <div className="stat-value">1,000</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">Mean Load</div>
                            <div className="stat-value">{stats.meanLoad.toLocaleString()} <span>MW</span></div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">Max Peak Load</div>
                            <div className="stat-value">{stats.maxPeak.toLocaleString()} <span>MW</span></div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">Min Load</div>
                            <div className="stat-value">{stats.minLoad.toLocaleString()} <span>MW</span></div>
                        </div>
                    </div>
                </div>

                {/* Optimization Strategy */}
                <div className="card">
                    <h3 style={{ marginBottom: 20, fontSize: 14 }}>Optimization Strategy Selection</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={strategy === 'expected'}
                                onChange={() => setStrategy('expected')}
                                style={{
                                    width: 18,
                                    height: 18,
                                    accentColor: 'var(--accent-cyan)'
                                }}
                            />
                            <span style={{ fontSize: 14 }}>Minimize Expected Cost (Weighted Average)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={strategy === 'worstcase'}
                                onChange={() => setStrategy('worstcase')}
                                style={{
                                    width: 18,
                                    height: 18,
                                    accentColor: 'var(--accent-cyan)'
                                }}
                            />
                            <span style={{ fontSize: 14 }}>Minimize Worst Case Regret (Robust Optimization)</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
