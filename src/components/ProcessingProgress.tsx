import type { ProcessingProgress } from '../types'

interface ProcessingProgressProps {
  progress: ProcessingProgress
}

export default function ProcessingProgress({ progress }: ProcessingProgressProps) {
  if (progress.step === 'idle') return null

  const percentage =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  const isError = progress.step === 'error'
  const isDone = progress.step === 'done'

  return (
    <div className={`progress-container ${isError ? 'progress-error' : ''} ${isDone ? 'progress-done' : ''}`}>
      <div className="progress-header">
        <span className="progress-message">{progress.message}</span>
        <span className="progress-percentage">{percentage}%</span>
      </div>
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${isError ? 'error' : ''} ${isDone ? 'done' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {progress.current > 0 && progress.total > 0 && (
        <p className="progress-count">
          {progress.current} de {progress.total}
        </p>
      )}
    </div>
  )
}
