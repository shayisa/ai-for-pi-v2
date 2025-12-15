/**
 * GenerationProgress Component
 *
 * Shows detailed progress during newsletter generation with editorial styling
 */

import React from 'react';
import { motion } from 'framer-motion';

interface GenerationStage {
  id: string;
  label: string;
}

const stages: GenerationStage[] = [
  { id: 'content', label: 'Generating content' },
  { id: 'search', label: 'Searching sources' },
  { id: 'images', label: 'Creating images' },
  { id: 'finalize', label: 'Finalizing' },
];

function getStageFromProgress(progress: number): string {
  if (progress < 30) return 'content';
  if (progress < 40) return 'search';
  if (progress < 90) return 'images';
  return 'finalize';
}

function getStageStatus(stageId: string, currentStage: string): 'completed' | 'active' | 'pending' {
  const stageOrder = stages.map(s => s.id);
  const currentIndex = stageOrder.indexOf(currentStage);
  const stageIndex = stageOrder.indexOf(stageId);

  if (stageIndex < currentIndex) return 'completed';
  if (stageIndex === currentIndex) return 'active';
  return 'pending';
}

interface GenerationProgressProps {
  progress: number;
  message: string;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  progress,
  message,
}) => {
  const currentStage = getStageFromProgress(progress);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progress bar */}
      <div className="mb-10">
        <div className="flex justify-between mb-2">
          <span className="font-sans text-overline text-slate uppercase tracking-widest">Progress</span>
          <span className="font-sans text-ui font-medium text-ink">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-pearl h-1 overflow-hidden">
          <motion.div
            className="bg-ink h-1 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Stage indicators - horizontal timeline */}
      <div className="flex items-center justify-between mb-8">
        {stages.map((stage, index) => {
          const status = getStageStatus(stage.id, currentStage);
          const isLast = index === stages.length - 1;

          return (
            <React.Fragment key={stage.id}>
              {/* Stage dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-3 h-3 transition-colors duration-300
                    ${status === 'completed' ? 'bg-ink' :
                      status === 'active' ? 'bg-editorial-red' : 'bg-silver'}
                  `}
                />
                <span
                  className={`
                    font-sans text-caption mt-2 text-center max-w-[80px]
                    ${status === 'active' ? 'text-ink font-medium' :
                      status === 'completed' ? 'text-slate' : 'text-silver'}
                  `}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 h-px mx-2 bg-border-subtle relative -top-3">
                  {status === 'completed' && (
                    <motion.div
                      className="absolute inset-0 bg-ink origin-left"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current message */}
      <motion.p
        key={message}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center font-serif text-ui text-slate italic"
      >
        {message}
      </motion.p>
    </div>
  );
};
