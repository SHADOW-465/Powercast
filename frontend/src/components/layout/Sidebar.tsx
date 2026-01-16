"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/", label: "Dashboard", icon: "📊" },
    { href: "/forecasts", label: "Forecasts", icon: "📈" },
    { href: "/scenarios", label: "Scenarios", icon: "🔮" },
    { href: "/patterns", label: "Patterns", icon: "🔄" },
    { href: "/assets", label: "Assets", icon: "⚡" },
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
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-item ${pathname === item.href ? "active" : ""}`}
                    >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
        </aside>
    );
}
