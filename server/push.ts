const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

type ExpoPushMessage = {
  to: string;
  sound: "default";
  channelId: "project-updates";
  title: string;
  body: string;
  data: {
    url: string;
    projectId: number;
    notificationKind: "pricing_ready" | "project_completed" | "project_update";
    title: string;
    body: string;
  };
};

export function isExpoPushToken(value: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(value);
}

export async function sendProjectUpdatePush(input: {
  tokens: string[];
  projectId: number;
  projectTitle: string;
  updateTitle: string;
  progressPercent: number;
  note?: string | null;
  hasImages?: boolean;
  notificationKind?: "pricing_ready" | "project_completed";
}) {
  const tokens = [...new Set(input.tokens.filter(isExpoPushToken))].slice(0, 100);
  if (tokens.length === 0) return { attempted: 0, accepted: 0 };

  const baseBody = input.note?.trim() || `وصل مشروع «${input.projectTitle}» إلى نسبة ${input.progressPercent}%`;
  const body = input.hasImages ? `${baseBody} · أُرفقت صور جديدة للمرحلة.` : baseBody;
  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    sound: "default",
    channelId: "project-updates",
    title: input.updateTitle,
    body,
    data: {
      url: `/project/${input.projectId}`,
      projectId: input.projectId,
      notificationKind: input.notificationKind ?? "project_update",
      title: input.updateTitle,
      body,
    },
  }));

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(messages),
    });
    if (!response.ok) return { attempted: tokens.length, accepted: 0 };
    const result = (await response.json()) as { data?: unknown[] };
    return { attempted: tokens.length, accepted: Array.isArray(result.data) ? result.data.length : 0 };
  } catch (error) {
    console.warn("[Push] Could not deliver project update:", error);
    return { attempted: tokens.length, accepted: 0 };
  }
}
