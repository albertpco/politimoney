export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "text/plain, application/xml, text/xml, */*",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`);
  }
  return response.text();
}

export async function fetchBytes(url: string, init?: RequestInit): Promise<Uint8Array> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/pdf, application/octet-stream, */*",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}) for ${url}: ${body.slice(0, 200)}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
