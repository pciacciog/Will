export interface WillForDisplay {
  title?: string | null;
  sharedWhat?: string | null;
  commitments?: { userId: string; what: string }[];
}

export function willDisplayTitle(
  will: WillForDisplay,
  currentUserId?: string,
  fallback = 'Untitled'
): string {
  if (will.title) return will.title;
  const myCommitment = currentUserId
    ? will.commitments?.find(c => c.userId === currentUserId)
    : will.commitments?.[0];
  return myCommitment?.what || will.sharedWhat || fallback;
}
