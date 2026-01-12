'use client';

import { useState, useEffect } from 'react';
import { Filter, Search, Droplet, Sun, Wind, Atom, MoreVertical } from 'lucide-react';
import {
    LineChart,
    Line,
    ResponsiveContainer
} from 'recharts';

import { fetchApi } from '@/lib/api';

const typeIcons: { [key: string]: React.ReactNode } = {
    hydro: <Droplet size={24} />,
    solar: <Sun size={24} />,
    wind: <Wind size={24} />,
    nuclear: <Atom size={24} />
};

const typeColors: { [key: string]: string } = {
    hydro: '#00d4ff',
    solar: '#ffd700',
    wind: '#00ff88',
    nuclear: '#a855f7'
};

export default function AssetsPage() {
    const [assets, setAssets] = useState<any[]>([]);
    const [filter, setFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadAssets() {
            try {
                const data = await fetchApi('/assets/');
                setAssets(data);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load assets", err);
            }
        }
        loadAssets();
        const interval = setInterval(loadAssets, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Loading Assets...</div>;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Grid Assets Overview</h1>
                <div className="page-filters">
                    <select className="filter-select" onChange={(e) => setFilter(e.target.value)}>
                        <option value="all">All Types</option>
                        <option value="hydro">Hydro</option>
                        <option value="solar">Solar</option>
                        <option value="wind">Wind</option>
                        <option value="nuclear">Nuclear</option>
                    </select>
                    <select className="filter-select">
                        <option value="all">All Status</option>
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                    </select>
                    <select className="filter-select">
                        <option value="all">All Regions</option>
                        <option value="CH_North">CH North</option>
                        <option value="CH_South">CH South</option>
                        <option value="CH_East">CH East</option>
                        <option value="CH_West">CH West</option>
                    </select>
                    <input type="text" className="search-input" placeholder="Search" />
                </div>
            </div>

            <div className="assets-grid">
                {assets
                    .filter(a => filter === 'all' || a.type === filter)
                    .map((asset) => (
                        <div key={asset.id} className="card asset-card">
                            <div className="asset-header">
                                <div>
                                    <div className="asset-title">{asset.id} - {asset.name}</div>
                                    <div className={`asset-status ${asset.status}`}>
                                        <span style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            background: asset.status === 'online' ? 'var(--accent-green)' : 'var(--accent-red)',
                                            display: 'inline-block',
                                            marginRight: 6
                                        }} />
                                        {asset.status.toUpperCase()}
                                    </div>
                                </div>
                                <div className="asset-health">
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: `rgba(${asset.health > 95 ? '0, 255, 136' : asset.health > 80 ? '255, 215, 0' : '255, 68, 68'}, 0.2)`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: typeColors[asset.type]
                                    }}>
                                        {typeIcons[asset.type]}
                                    </div>
                                    <div>
                                        <div className="health-value">{asset.health}%</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Health</div>
                                    </div>
                                    <MoreVertical size={18} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
                                </div>
                            </div>

                            <div className="asset-metrics">
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Current Output</div>
                                <div className="asset-output">
                                    {asset.output} <span>MW</span>
                                </div>

                                {asset.reservoirLevel !== undefined && (
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Reservoir Level</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: 24, fontWeight: 700 }}>{asset.reservoirLevel}%</span>
                                            <div style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: '50%',
                                                border: `3px solid ${typeColors[asset.type]}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 10,
                                                color: 'var(--text-muted)'
                                            }}>
                                                Reservoir
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: 16 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Mini Sparkline</div>
                                    <ResponsiveContainer width="100%" height={40}>
                                        <LineChart data={(asset.sparkline || []).map((v: number) => ({ v }))}>
                                            <Line
                                                type="monotone"
                                                dataKey="v"
                                                stroke={typeColors[asset.type]}
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="asset-tabs">
                                {['CONTROL', 'FORECAST', 'HISTORY'].map((tab) => (
                                    <button
                                        key={tab}
                                        className={`asset-tab ${activeTab[asset.id] === tab ? 'active' : ''}`}
                                        onClick={() => setActiveTab({ ...activeTab, [asset.id]: tab })}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}
