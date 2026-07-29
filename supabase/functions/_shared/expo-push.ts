export async function sendExpoPush(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{ to: pushToken, title, body, data }]),
  }).catch(() => {
    // Push delivery is best-effort — the in-app state is already correct
    // regardless of whether the notification lands.
  });
}
