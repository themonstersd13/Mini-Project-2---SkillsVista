export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (typeof data?.error === "string") {
      throw new Error(data.error);
    }

    if (data?.error?.fieldErrors) {
      const fieldErrors = data.error.fieldErrors as Record<string, string[] | undefined>;
      const firstError = Object.values(fieldErrors).flat().find(Boolean);
      throw new Error(firstError ?? `Request failed with status ${response.status}`);
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  return data as T;
}
