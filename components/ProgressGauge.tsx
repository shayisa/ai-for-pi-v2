import React from 'react';

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
        small: { container: 'w-20 h-20', radius: 36, strokeWidth: 3, fontSize: 'text-xs' },
        medium: { container: 'w-32 h-32', radius: 56, strokeWidth: 4, fontSize: 'text-sm' },
        large: { container: 'w-48 h-48', radius: 88, strokeWidth: 5, fontSize: 'text-lg' }
    };

    const dim = dimensions[size];
    const circumference = 2 * Math.PI * dim.radius;
    const offset = circumference - (normalizedProgress / 100) * circumference;

    // Color based on progress
    let colorClass = 'text-accent-salmon';
    if (normalizedProgress < 33) {
        colorClass = 'text-accent-muted-blue';
    } else if (normalizedProgress < 66) {
        colorClass = 'text-accent-light-blue';
    } else if (normalizedProgress < 100) {
        colorClass = 'text-accent-salmon';
    } else {
        colorClass = 'text-green-500';
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
                        className="text-gray-200"
                    />
                    {/* Progress ring */}
                    <circle
                        cx={dim.radius + 10}
                        cy={dim.radius + 10}
                        r={dim.radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={dim.strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={`${colorClass} transition-all duration-500 ease-out`}
                    />
                </svg>

                {/* Center text */}
                <div className="relative z-10 text-center">
                    <div className={`font-bold ${dim.fontSize} ${colorClass}`}>
                        {Math.round(normalizedProgress)}%
                    </div>
                </div>
            </div>

            {/* Message below gauge */}
            {message && (
                <p className="text-center text-sm text-secondary-text animate-pulse">
                    {message}
                </p>
            )}
        </div>
    );
};
