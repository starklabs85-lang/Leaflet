import { secureStorageAdapter } from "@/lib/secure-storage";

export const STREAK_MILESTONES = [7, 14, 30, 100] as const;

export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

function getMilestoneKey(userId: string) {
  return `leaflet:care_streak_milestones:${userId}`;
}

export async function getPendingStreakMilestone({
  currentStreak,
  userId
}: {
  currentStreak: number;
  userId: string;
}) {
  const celebrated = await readCelebratedMilestones(userId);
  const pending = STREAK_MILESTONES.filter(
    (milestone) => currentStreak >= milestone && !celebrated.has(milestone)
  );

  return pending.length > 0 ? pending[pending.length - 1] : null;
}

export async function markStreakMilestoneCelebrated({
  milestone,
  userId
}: {
  milestone: StreakMilestone;
  userId: string;
}) {
  const celebrated = await readCelebratedMilestones(userId);

  for (const achieved of STREAK_MILESTONES) {
    if (achieved <= milestone) {
      celebrated.add(achieved);
    }
  }

  await secureStorageAdapter.setItem(
    getMilestoneKey(userId),
    JSON.stringify([...celebrated])
  );
}

async function readCelebratedMilestones(userId: string) {
  const value = await secureStorageAdapter.getItem(getMilestoneKey(userId));
  const milestones = new Set<StreakMilestone>();

  if (!value) {
    return milestones;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (isStreakMilestone(item)) {
          milestones.add(item);
        }
      }
    }
  } catch {
    await secureStorageAdapter.removeItem(getMilestoneKey(userId));
  }

  return milestones;
}

function isStreakMilestone(value: unknown): value is StreakMilestone {
  return STREAK_MILESTONES.includes(value as StreakMilestone);
}
