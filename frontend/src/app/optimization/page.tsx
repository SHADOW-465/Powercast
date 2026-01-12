'use client';

import { Zap, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const recommendations = [
    {
        id: 1,
        title: 'Increase Reserve Capacity',
        description: 'High solar variability expected between 14:00-16:00. Recommend increasing secondary reserve by 50 MW.',
        priority: 'high',
        status: 'pending',
        estimatedSavings: 'CHF 12,500'
    },
    {
        id: 2,
        title: 'Optimize Pump Schedule',
        description: 'Price differential favorable for pumping between 02:00-06:00. Shift pumping from current 00:00-04:00 schedule.',
        priority: 'medium',
        status: 'accepted',
        estimatedSavings: 'CHF 8,200'
    },
    {
        id: 3,
        title: 'Reduce Export to Germany',
        description: 'Forecast suggests local demand spike at 18:00. Reduce export commitment by 100 MW.',
        priority: 'medium',
        status: 'pending',
        estimatedSavings: 'CHF 5,400'
    }
];

export default function OptimizationPage() {
    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Optimization Engine</h1>
                <div className="optimization-status">
                    <div className="optimization-dot" />
                    <span className="optimization-text">Engine Active</span>
                    <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
                        Last run: 2 minutes ago
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Objective Value</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-green)' }}>CHF 1.23M</div>
                    <div style={{ fontSize: 12, color: 'var(--accent-green)', marginTop: 4 }}>↓ 4.2% vs baseline</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Constraints</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-green)' }}>All Satisfied</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>47/47 active</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Solve Time</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>3.24s</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>P95: 4.8s</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Pending Actions</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-orange)' }}>3</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Awaiting approval</div>
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 600 }}>Optimization Recommendations</h3>

                {recommendations.map((rec) => (
                    <div key={rec.id} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 16,
                        padding: 20,
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 12,
                        marginBottom: 16,
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: rec.priority === 'high' ? 'rgba(255, 68, 68, 0.2)' : 'rgba(255, 215, 0, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: rec.priority === 'high' ? 'var(--accent-red)' : 'var(--accent-yellow)'
                        }}>
                            {rec.priority === 'high' ? <AlertTriangle size={20} /> : <Zap size={20} />}
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{rec.title}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{rec.description}</div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                                <span style={{ color: 'var(--accent-green)' }}>Est. Savings: {rec.estimatedSavings}</span>
                                <span style={{ color: 'var(--text-muted)' }}>Priority: {rec.priority}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {rec.status === 'pending' ? (
                                <>
                                    <button style={{
                                        background: 'var(--accent-green)',
                                        color: 'black',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: 6,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}>Accept</button>
                                    <button style={{
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        border: '1px solid var(--border-color)',
                                        padding: '8px 16px',
                                        borderRadius: 6,
                                        fontSize: 12,
                                        cursor: 'pointer'
                                    }}>Reject</button>
                                </>
                            ) : (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    color: 'var(--accent-green)',
                                    fontSize: 13
                                }}>
                                    <CheckCircle size={16} />
                                    Accepted
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
