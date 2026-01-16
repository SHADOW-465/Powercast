"use client";

import { useEffect, useState } from "react";

export default function Header() {
    const [currentTime, setCurrentTime] = useState<string>("");
    const [frequency, setFrequency] = useState<number>(50.0);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(
                now.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                })
            );
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);

        // Simulate frequency fluctuation
        const freqInterval = setInterval(() => {
            setFrequency(49.95 + Math.random() * 0.1);
        }, 2000);

        return () => {
            clearInterval(interval);
            clearInterval(freqInterval);
        };
    }, []);

    return (
        <header className="header">
            <div className="header-left">
                <div className="station-selector">
                    <span>📍</span>
                    <span>Swiss Grid Control Center</span>
                </div>
                <div className="live-indicator">
                    <div className="live-dot"></div>
                    <span className="live-text">LIVE</span>
                </div>
                <span className="timestamp">{currentTime}</span>
            </div>

            <div className="header-center">
                <span className="frequency-label">Grid Frequency</span>
                <span className="frequency-value">{frequency.toFixed(2)} Hz</span>
            </div>

            <div className="header-right">
                <button className="override-btn">⚠️ Manual Override</button>
                <div className="user-profile">
                    <div className="user-info">
                        <div className="user-name">Grid Operator</div>
                        <div className="user-role">Control Room</div>
                    </div>
                    <div className="user-avatar">GO</div>
                </div>
            </div>
        </header>
    );
}
