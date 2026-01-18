"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    TrendingUp,
    PlayCircle,
    History,
    Zap,
    Brain,
    Settings,
    Activity
} from "lucide-react";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/forecasts", label: "Forecasts", icon: TrendingUp },
    { href: "/scenarios", label: "Scenarios", icon: PlayCircle },
    { href: "/historical", label: "Historical", icon: History },
    { href: "/optimization", label: "Optimization", icon: Activity },
    { href: "/adaptive-learning", label: "Patterns", icon: Brain },
    { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="icon">⚡</div>
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
                            className={`nav-item ${isActive ? "active" : ""}`}
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border-color)',
                marginTop: 'auto'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: 'var(--nm-bg-base)',
                    borderRadius: '12px',
                    boxShadow: 'var(--nm-shadow-inset)'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        background: 'var(--accent-green)',
                        borderRadius: '50%',
                        boxShadow: '0 0 12px var(--accent-green-glow)',
                        animation: 'pulse-glow 2s ease-in-out infinite'
                    }} />
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>System Status</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)' }}>OPERATIONAL</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
