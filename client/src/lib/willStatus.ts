/**
 * Centralized Will Status Logic
 * 
 * CRITICAL: This function is the ONLY place where will status should be determined.
 * It ALWAYS trusts the backend status as the single source of truth.
 * 
 * Backend scheduler (server/scheduler.ts) runs every minute and handles ALL state transitions:
 * - pending/scheduled → active (when start time passes)
 * - active → will_review (when end time passes - NEW FEATURE)
 * - will_review → completed (when all members submit reviews)
 * - End Room: pending → open (when scheduled time passes)
 */

export function getWillStatus(will: any, userId?: string): string {
  if (!will) return 'no_will';
  
  // ALWAYS trust backend status - this is the single source of truth
  // Backend scheduler handles ALL state transitions every minute
  
  // If will is archived, treat as no will
  if (will.status === 'archived') return 'no_will';
  
  // NEW FEATURE: Trust backend for will_review (will ended, waiting for member reviews)
  if (will.status === 'will_review') {
    return will.status;
  }
  
  // FIXED: Legacy 'waiting_for_end_room' should be treated as 'will_review'
  // The backend now transitions these properly, but if we see it client-side,
  // display it as will_review so the WillReviewFlow modal appears correctly
  if (will.status === 'waiting_for_end_room') {
    return 'will_review';
  }
  
  // Trust backend for active status (will is currently running)
  if (will.status === 'active') {
    return will.status;
  }
  
  // Trust backend for scheduled status (all members committed, waiting to start)
  if (will.status === 'scheduled') {
    return will.status;
  }
  
  // Trust backend for pending status
  if (will.status === 'pending') {
    return will.status;
  }
  
  // Special handling for completed status
  // IMPORTANT: Show completed status until LOCAL user acknowledges
  // Don't hide the will just because other users have acknowledged
  if (will.status === 'completed') {
    // If userId provided and this user has acknowledged, allow new will creation
    if (userId && will.hasUserAcknowledged) {
      // Check if ALL committed members have acknowledged
      const committedMemberCount = will.commitments?.length || 0;
      const acknowledgedCount = will.acknowledgedCount || 0;
      
      if (acknowledgedCount >= committedMemberCount) {
        return 'no_will'; // All committed members acknowledged, can start new will
      }
    }
    
    return 'completed';
  }
  
  // Fallback: if backend hasn't set a status yet, default to no_will
  // This should never happen as backend always sets an initial status
  return 'no_will';
}
