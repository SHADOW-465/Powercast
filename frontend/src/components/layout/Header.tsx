'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';

export default function Header() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [frequency, setFrequency] = useState(50.02);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
            // Simulate small frequency variations
            setFrequency(50 + (Math.random() - 0.5) * 0.05);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).toUpperCase().replace(/ /g, ' ');
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    return (
        <header className="header">
            <div className="header-left">
                <div className="station-selector">
                    <span>TSO-CH-PRIMARY-01</span>
                    <ChevronDown size={16} />
                </div>

                <div className="live-indicator">
                    <div className="live-dot" />
                    <span className="live-text">LIVE DATA</span>
                </div>

                <span className="timestamp">
                    {formatDate(currentTime)} {formatTime(currentTime)} CET
                </span>
            </div>

            <div className="header-center">
                <span className="frequency-label">Grid Frequency</span>
                <span className="frequency-value">{frequency.toFixed(2)} Hz</span>
            </div>

            <div className="header-right">
                <button className="override-btn">
                    MANUAL OVERRIDE
                </button>

                <div className="user-profile">
                    <div className="user-info">
                        <div className="user-name">M. Weber</div>
                        <div className="user-role">SENIOR OPERATOR</div>
                    </div>
                    <div className="user-avatar">
                        <User size={18} />
                    </div>
                </div>
            </div>
        </header>
    );
}
