export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new HttpError(res.status, `GET ${url} failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}
