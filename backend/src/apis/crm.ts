// Заглушка CRM-интеграции: отправка заявки из мастера подбора
export async function sendSelectionApplication(payload: unknown): Promise<{ ok: boolean }> {
  // Здесь будет интеграция с CRM (HTTP/SDK). Пока возвращаем успех.
  return { ok: true }
}