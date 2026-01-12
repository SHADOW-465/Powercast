'use client';

import { User, Bell, Database, Shield, Palette, Globe } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 24 }}>
                <div className="card" style={{ height: 'fit-content' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[
                            { icon: User, label: 'Profile', active: true },
                            { icon: Bell, label: 'Notifications' },
                            { icon: Database, label: 'Data Sources' },
                            { icon: Shield, label: 'Security' },
                            { icon: Palette, label: 'Appearance' },
                            { icon: Globe, label: 'Regions' }
                        ].map((item) => (
                            <div key={item.label} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 16px',
                                borderRadius: 8,
                                cursor: 'pointer',
                                background: item.active ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                                color: item.active ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                            }}>
                                <item.icon size={18} />
                                {item.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: 24, fontSize: 16, fontWeight: 600 }}>Profile Settings</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Display Name
                            </label>
                            <input
                                type="text"
                                defaultValue="M. Weber"
                                style={{
                                    width: '100%',
                                    maxWidth: 400,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '12px 16px',
                                    color: 'var(--text-primary)',
                                    fontSize: 14
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Email
                            </label>
                            <input
                                type="email"
                                defaultValue="m.weber@swissgrid.ch"
                                style={{
                                    width: '100%',
                                    maxWidth: 400,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 8,
                                    padding: '12px 16px',
                                    color: 'var(--text-primary)',
                                    fontSize: 14
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Role
                            </label>
                            <select style={{
                                width: '100%',
                                maxWidth: 400,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: '12px 16px',
                                color: 'var(--text-primary)',
                                fontSize: 14
                            }}>
                                <option>Senior Operator</option>
                                <option>Junior Operator</option>
                                <option>Administrator</option>
                                <option>Viewer</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Timezone
                            </label>
                            <select style={{
                                width: '100%',
                                maxWidth: 400,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: '12px 16px',
                                color: 'var(--text-primary)',
                                fontSize: 14
                            }}>
                                <option>Europe/Zurich (CET)</option>
                                <option>UTC</option>
                            </select>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <button style={{
                                background: 'var(--accent-cyan)',
                                color: 'black',
                                border: 'none',
                                padding: '12px 24px',
                                borderRadius: 8,
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
