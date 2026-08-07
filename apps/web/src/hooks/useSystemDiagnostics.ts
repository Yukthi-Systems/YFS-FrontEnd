import { useEffect, useState } from "react";
import { getJson, getApiJson } from "@yfs/service";

interface Example {
  message: string;
}

// Backing state for the "System" sidebar tab's demo API calls.
export function useSystemDiagnostics(token: string | null) {
  const [exampleMessage, setExampleMessage] = useState<string>("loading...");
  const [apiResponse, setApiResponse] = useState<string>("");
  const [apiLoading, setApiLoading] = useState<boolean>(false);

  useEffect(() => {
    getJson<Example>("/example.json")
      .then((data) => setExampleMessage(data.message))
      .catch((err) => setExampleMessage(`error: ${err.message}`));
  }, []);

  const testAuthenticatedApi = async () => {
    if (!token) return;
    setApiLoading(true);
    setApiResponse("");
    try {
      const data = await getApiJson<unknown>("/", { headers: { Authorization: `Bearer ${token}` } });
      setApiResponse(`Success: ${JSON.stringify(data)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to query backend API";
      setApiResponse(`Error: ${message}`);
    } finally {
      setApiLoading(false);
    }
  };

  return { exampleMessage, apiResponse, apiLoading, testAuthenticatedApi };
}
