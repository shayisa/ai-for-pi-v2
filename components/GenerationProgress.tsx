/**
 * GenerationProgress Component
 *
 * Shows detailed progress during newsletter generation with:
 * - Stage indicators (content, search, images, verification)
 * - Visual progress bar
 * - Current stage highlighting
 */

import React from 'react';
import { Spinner } from './Spinner';

interface GenerationStage {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const stages: GenerationStage[] = [
  {
    id: 'content',
    label: 'Generating content',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Searching sources',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'images',
    label: 'Creating images',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'finalize',
    label: 'Finalizing',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
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
    <div className="w-full max-w-lg mx-auto">
      {/* Main progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-primary-text">Progress</span>
          <span className="text-sm font-medium text-accent-salmon">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-accent-light-blue to-accent-salmon h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="space-y-3">
        {stages.map((stage) => {
          const status = getStageStatus(stage.id, currentStage);

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                status === 'active'
                  ? 'bg-accent-salmon/10 border border-accent-salmon/30'
                  : status === 'completed'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              {/* Icon */}
              <div
                className={`flex-shrink-0 ${
                  status === 'active'
                    ? 'text-accent-salmon'
                    : status === 'completed'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                {status === 'active' ? (
                  <div className="animate-spin">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : status === 'completed' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stage.icon
                )}
              </div>

              {/* Label */}
              <span
                className={`font-medium ${
                  status === 'active'
                    ? 'text-accent-salmon'
                    : status === 'completed'
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}
              >
                {stage.label}
              </span>

              {/* Status badge */}
              {status === 'completed' && (
                <span className="ml-auto text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  Done
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Current message */}
      <p className="mt-6 text-center text-sm text-secondary-text animate-pulse">
        {message}
      </p>
    </div>
  );
};
