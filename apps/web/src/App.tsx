import { useEffect, useState } from "react";
import { capitalize, slugify, formatCurrency } from "@yfs/utils";
import { getJson } from "@yfs/service";
import "./App.css";

interface Example {
  message: string;
}

function App() {
  const [name, setName] = useState("yfs monorepo");
  const [fetched, setFetched] = useState<string>("loading...");

  useEffect(() => {
    getJson<Example>("/example.json")
      .then((data) => setFetched(data.message))
      .catch((err) => setFetched(`error: ${err.message}`));
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>{capitalize(name)}</h1>
      <p>slug: {slugify(name)}</p>
      <p>example price: {formatCurrency(499)}</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: "0.5rem", width: "100%" }}
      />
      <p style={{ color: "#888", fontSize: "0.85rem" }}>
        This page imports capitalize, slugify, and formatCurrency from the{" "}
        <code>@yfs/utils</code> workspace package. Edit{" "}
        <code>packages/utils/src</code> and this page hot-reloads.
      </p>

      <p style={{ marginTop: "2rem" }}>
        <strong>@yfs/service</strong> says: {fetched}
      </p>
      <p style={{ color: "#888", fontSize: "0.85rem" }}>
        Fetched via <code>getJson</code> from <code>@yfs/service</code>,
        which just calls <code>public/example.json</code> here. Point it at
        a real API URL once you have a backend.
      </p>
    </main>
  );
}

export default App;
