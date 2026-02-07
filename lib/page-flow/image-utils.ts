import imageCompression from "browser-image-compression";
import { loadImageFromDataUrl } from "@/lib/mediapipe";

export const compressImage = async (file: File) => {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1024,
    initialQuality: 0.82,
    useWebWorker: true,
  });
  const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
  const image = await loadImageFromDataUrl(dataUrl);
  return { dataUrl, width: image.width, height: image.height };
};
