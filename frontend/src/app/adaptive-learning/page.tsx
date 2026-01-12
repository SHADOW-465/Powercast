'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Sun, Calendar, Wind, ExternalLink } from 'lucide-react';
import { fetchApi } from '@/lib/api';

const iconBgColors: { [key: string]: string } = {
    red: 'rgba(255, 68, 68, 0.2)',
    yellow: 'rgba(255, 215, 0, 0.2)',
    blue: 'rgba(0, 212, 255, 0.2)'
};

const iconColors: { [key: string]: string } = {
    red: 'var(--accent-red)',
    yellow: 'var(--accent-yellow)',
    blue: 'var(--accent-cyan)'
};

const iconMap: { [key: string]: any } = {
    TrendingUp, Sun, Calendar, Wind
};

export default function AdaptiveLearningPage() {
    const [patterns, setPatterns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadPatterns() {
            try {
                const data = await fetchApi('/patterns/library');
                const mapped = data.map((p: any) => ({
                    ...p,
                    icon: iconMap[p.icon] || p.icon
                }));
                setPatterns(mapped);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load patterns", err);
            }
        }
        loadPatterns();
    }, []);

    if (loading) return <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Analyzing Grid Patterns...</div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Adaptive Learning - Pattern Library</h1>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 24, fontSize: 16, fontWeight: 600 }}>Patterns Detected Today</h3>

                {patterns.map((pattern) => {
                    const Icon = pattern.icon;

                    return (
                        <div key={pattern.id} className="pattern-card card">
                            <div
                                className="pattern-icon"
                                style={{
                                    background: iconBgColors[pattern.iconColor] || 'rgba(255,255,255,0.1)',
                                    color: iconColors[pattern.iconColor] || 'var(--text-primary)'
                                }}
                            >
                                {typeof Icon === 'function' ? <Icon size={24} /> : <TrendingUp size={24} />}
                            </div>

                            <div className="pattern-content">
                                <div className="pattern-title">{pattern.name}</div>
                                <div className="pattern-description">{pattern.description}</div>
                                <span className={`confidence-badge ${(pattern.confidenceLabel || 'Medium').toLowerCase()}`}>
                                    Confidence: {pattern.confidenceLabel || 'Medium'}
                                </span>
                            </div>

                            <a href="#" className="view-details" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                View Details
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div className="card">
                    <h3 style={{ marginBottom: 20, fontSize: 14 }}>Pattern Library Statistics</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Total Patterns Learned</span>
                            <span style={{ fontWeight: 600 }}>47</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Average Success Rate</span>
                            <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>84%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Errors Prevented (30d)</span>
                            <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>156</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Cost Savings Est.</span>
                            <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>CHF 2.4M</span>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: 20, fontSize: 14 }}>Learning Activity</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Patterns Applied Today</span>
                            <span style={{ fontWeight: 600 }}>12</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>New Patterns (7d)</span>
                            <span style={{ fontWeight: 600 }}>3</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Model Adaptations</span>
                            <span style={{ fontWeight: 600 }}>8</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Learning Status</span>
                            <span className="status-badge adequate">Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
