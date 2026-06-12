import { useCallback, useState } from "react";
import { useMatrixClient } from "./use-matrix-client";

export const MAX_UPLOAD_BYTES = 524_288; // 0.5 MB

export interface MediaUploadState {
  uploading: boolean;
  progress: number; // 0..1
}

export function useMediaUpload(): MediaUploadState & {
  upload: (file: File) => Promise<{ contentUri: string }>;
} {
  const client = useMatrixClient();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      try {
        const { content_uri } = await (
          client as unknown as {
            uploadContent: (
              f: File,
              opts?: { progressHandler?: (p: { loaded: number; total: number }) => void },
            ) => Promise<{ content_uri: string }>;
          }
        ).uploadContent(file, {
          progressHandler: ({ loaded, total }) =>
            setProgress(total ? loaded / total : 0),
        });
        return { contentUri: content_uri };
      } finally {
        setUploading(false);
      }
    },
    [client],
  );

  return { upload, uploading, progress };
}
