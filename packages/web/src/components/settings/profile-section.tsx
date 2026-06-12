import { useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MatrixClientPeg } from "@/client/peg";

export function ProfileSection({ onSaved }: { onSaved: () => void }) {
  const client = useSyncExternalStore(
    (cb) => MatrixClientPeg.subscribe(cb),
    () => MatrixClientPeg.safeGet(),
    () => null,
  );
  const userId = client?.getUserId() ?? "";
  const initialName = client?.getUser(userId)?.displayName ?? "";
  const [name, setName] = useState(initialName);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!client) return;
    setSaving(true);
    try {
      if (name.trim() && name !== initialName) {
        await client.setDisplayName(name.trim());
      }
      if (file) {
        const { content_uri } = await (client as unknown as {
          uploadContent: (f: File) => Promise<{ content_uri: string }>;
        }).uploadContent(file);
        await client.setAvatarUrl(content_uri);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="profile-display-name">Display name</Label>
          <Input
            id="profile-display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="profile-avatar">Avatar</Label>
          <Input
            id="profile-avatar"
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <DialogFooter className="mt-4">
        <Button onClick={save} disabled={saving} aria-busy={saving}>
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
