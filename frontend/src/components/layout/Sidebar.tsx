'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    TrendingUp,
    Zap,
    Box,
    Layers,
    History,
    Brain,
    Settings,
    Activity
} from 'lucide-react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/forecasts', label: 'Forecasts', icon: TrendingUp, badge: true },
    { href: '/optimization', label: 'Optimization', icon: Zap, badge: true },
    { href: '/assets', label: 'Assets', icon: Box },
    { href: '/scenarios', label: 'Scenarios', icon: Layers },
    { href: '/historical', label: 'Historical', icon: History },
    { href: '/adaptive-learning', label: 'Adaptive Learning', icon: Brain },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="icon">
                    <Activity size={20} color="white" />
                </div>
                <h1>Powercast AI</h1>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                            {item.badge && (
                                <span style={{
                                    marginLeft: 'auto',
                                    background: 'rgba(0, 212, 255, 0.2)',
                                    color: 'var(--accent-cyan)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '10px'
                                }}>
                                    LIVE
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
