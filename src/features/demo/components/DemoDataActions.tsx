import { useRef, useState } from "react";
import { useAppDispatch } from "@/store/context";
import { stateImported } from "@/store/actions";
import { getBundledFixture, parseFixture } from "@/services/demoDataService";
import Button from "@/components/ui/Button";

export default function DemoDataActions() {
  const dispatch = useAppDispatch();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBundled = () => {
    setError(null);
    dispatch(stateImported(getBundledFixture()));
  };

  const importJson = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      const text = await files[0].text();
      const fixture = parseFixture(JSON.parse(text));
      dispatch(stateImported(fixture));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="ghost" onClick={loadBundled}>
          Load demo data
        </Button>
        <Button variant="ghost" onClick={() => fileInput.current?.click()}>
          Import JSON…
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => importJson(e.target.files)}
        />
      </div>
      {error && (
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--k-danger)", maxWidth: 360 }}>
          {error}
        </p>
      )}
    </div>
  );
}
