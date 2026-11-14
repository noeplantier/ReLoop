import { useState } from "react";
import { Header } from "./components/Header";
import { RequestScreen, type RequestDraft } from "./screens/RequestScreen";
import { API_URL, type DataMode } from "./lib/config";
import { presetById } from "./lib/presets";

type Step = { name: "request" } | { name: "review"; draft: RequestDraft };

const EMPTY: RequestDraft = { text: "", startDate: "", endDate: "", location: "" };

export default function App() {
  const [mode, setMode] = useState<DataMode>("live");
  const [step, setStep] = useState<Step>({ name: "request" });
  const [draft, setDraft] = useState<RequestDraft>(EMPTY);

  return (
    <div className="app">
      <Header mode={mode} />
      {step.name === "request" && (
        <RequestScreen
          draft={draft}
          mode={mode}
          onModeChange={setMode}
          onSubmit={(d) => {
            setDraft(d);
            setStep({ name: "review", draft: d });
          }}
        />
      )}
      {step.name === "review" && (
        // Placeholder until the review screen is built (next deliverable).
        <main className="placeholder">
          <h1>Review your request</h1>
          <p>Next step in progress. Your request:</p>
          <blockquote>{step.draft.text}</blockquote>
          <p>
            {step.draft.startDate || "no start date"} → {step.draft.endDate || "no end date"} ·{" "}
            {presetById(step.draft.location)?.name ?? "no location"}
          </p>
          <p className="placeholder__meta">
            Data: {mode} · API: {API_URL ?? "not configured"}
          </p>
          <button className="btn btn--ghost" onClick={() => setStep({ name: "request" })}>
            Back
          </button>
        </main>
      )}
    </div>
  );
}
