import React from 'react';
import { motion } from 'framer-motion';

interface ProgressGaugeProps {
    progress: number; // 0-100
    message?: string;
    size?: 'small' | 'medium' | 'large';
}

export const ProgressGauge: React.FC<ProgressGaugeProps> = ({
    progress,
    message,
    size = 'medium'
}) => {
    // Clamp progress between 0 and 100
    const normalizedProgress = Math.min(Math.max(progress, 0), 100);

    // Determine dimensions based on size
    const dimensions = {
        small: { container: 'w-20 h-20', radius: 36, strokeWidth: 3, fontSize: 'text-caption' },
        medium: { container: 'w-32 h-32', radius: 56, strokeWidth: 4, fontSize: 'text-ui' },
        large: { container: 'w-48 h-48', radius: 88, strokeWidth: 5, fontSize: 'text-h3' }
    };

    const dim = dimensions[size];
    const circumference = 2 * Math.PI * dim.radius;
    const offset = circumference - (normalizedProgress / 100) * circumference;

    // Editorial color based on progress
    let colorClass = 'text-ink';
    if (normalizedProgress < 33) {
        colorClass = 'text-slate';
    } else if (normalizedProgress < 66) {
        colorClass = 'text-charcoal';
    } else if (normalizedProgress < 100) {
        colorClass = 'text-ink';
    } else {
        colorClass = 'text-editorial-navy';
    }

    return (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className={`relative ${dim.container} flex items-center justify-center`}>
                {/* Background circle */}
                <svg
                    className="absolute inset-0 transform -rotate-90"
                    viewBox={`0 0 ${dim.radius * 2 + 20} ${dim.radius * 2 + 20}`}
                >
                    {/* Background ring */}
                    <circle
                        cx={dim.radius + 10}
                        cy={dim.radius + 10}
                        r={dim.radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={dim.strokeWidth}
                        className="text-pearl"
                    />
                    {/* Progress ring */}
                    <motion.circle
                        cx={dim.radius + 10}
                        cy={dim.radius + 10}
                        r={dim.radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={dim.strokeWidth}
                        strokeDasharray={circumference}
                        strokeLinecap="square"
                        className={colorClass}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                </svg>

                {/* Center text */}
                <div className="relative z-10 text-center">
                    <div className={`font-sans font-medium ${dim.fontSize} ${colorClass}`}>
                        {Math.round(normalizedProgress)}%
                    </div>
                </div>
            </div>

            {/* Message below gauge */}
            {message && (
                <motion.p
                    key={message}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center font-serif text-body text-slate italic"
                >
                    {message}
                </motion.p>
            )}
        </div>
    );
};
