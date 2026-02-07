import { NextResponse } from "next/server";
import { createFace, getFace, saveMediapipeLandmarks } from "@/lib/store";
import type { FaceRecord, Landmark } from "@/lib/types";
import { normalizeLandmarks, type LandmarkInput } from "@/lib/landmarks";

type Params = { path?: string[] };

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const toPixels = (
  point: Landmark,
  imageWidth: number,
  imageHeight: number,
  normalized: boolean
) => ({
  x: normalized ? point.x * imageWidth : point.x,
  y: normalized ? point.y * imageHeight : point.y,
});

const buildSideLandmarks = (
  points: Landmark[],
  imageWidth: number,
  imageHeight: number
) => {
  const safeWidth = Math.max(1, Number.isFinite(imageWidth) ? imageWidth : 1);
  const safeHeight = Math.max(1, Number.isFinite(imageHeight) ? imageHeight : 1);
  if (!points.length) {
    return {
      rotationAngle: 0,
      direction: "left" as const,
      center: { x: safeWidth / 2, y: safeHeight / 2 },
      crop: {
        x: safeWidth * 0.2,
        y: safeHeight * 0.1,
        width: safeWidth * 0.6,
        height: safeHeight * 0.8,
        scale: 1.2,
      },
      landmarks: Array.from({ length: 106 }).map(() => ({
        x: safeWidth / 2,
        y: safeHeight / 2,
      })),
      bbox: [
        safeWidth * 0.2,
        safeHeight * 0.1,
        safeWidth * 0.8,
        safeHeight * 0.9,
      ],
    };
  }

  const maxX = Math.max(...points.map((pt) => pt.x));
  const normalized = maxX <= 2;

  const pixelPoints = points.map((pt) => toPixels(pt, safeWidth, safeHeight, normalized));
  const xs = pixelPoints.map((pt) => pt.x);
  const ys = pixelPoints.map((pt) => pt.y);
  const minX = Math.min(...xs);
  const maxXpx = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxYpx = Math.max(...ys);
  const centerX = (minX + maxXpx) / 2;
  const centerY = (minY + maxYpx) / 2;
  const bboxWidth = Math.max(maxXpx - minX, 1);
  const bboxHeight = Math.max(maxYpx - minY, 1);
  const scale = 1.25;
  const cropWidth = bboxWidth * scale;
  const cropHeight = bboxHeight * scale;
  const cropX = clamp(centerX - cropWidth / 2, 0, safeWidth - cropWidth);
  const cropY = clamp(centerY - cropHeight / 2, 0, safeHeight - cropHeight);
  const direction = centerX < safeWidth / 2 ? "left" : "right";

  const step = Math.max(1, Math.floor(pixelPoints.length / 106));
  const landmarks = [];
  for (let i = 0; i < pixelPoints.length && landmarks.length < 106; i += step) {
    landmarks.push({ x: pixelPoints[i].x, y: pixelPoints[i].y });
  }
  while (landmarks.length < 106) {
    landmarks.push({ x: centerX, y: centerY });
  }

  return {
    rotationAngle: 0,
    direction,
    center: { x: centerX, y: centerY },
    crop: {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
      scale,
    },
    landmarks,
    bbox: [minX, minY, maxXpx, maxYpx],
  };
};

export async function GET(_: Request, context: { params: Promise<Params> }) {
  const { path = [] } = await context.params;

  if (path[0] === "health") {
    return json({
      success: true,
      ok: true,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      persistEnabled: process.env.FACE_STORE_PERSIST === "1",
    });
  }

  if (path[0] === "subscription") {
    const totalQuota = 50;
    const used = 3;
    const remaining = totalQuota - used;
    const resetAtIso = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    return json({
      success: true,
      subscription: null,
      quotaUsage: {
        totalQuota,
        hasQuota: remaining > 0,
        quotas: {
          faces: {
            amount: totalQuota,
            used,
            remaining,
          },
        },
        used,
        remaining,
        total: totalQuota,
        resetAtIso,
      },
    });
  }

  if (path[0] === "auth" && path[1] === "session") {
    return json({ user: null, expires: null });
  }

  if (path[0] === "faces" && path.length >= 2) {
    const id = path[1];
    const record = getFace(id);
    if (!record) return json({ success: false, message: "Face not found." }, 404);

    if (path.length === 3 && path[2] === "segmented") {
      return json({
        success: true,
        frontUrl: null,
        sideUrl: null,
        hasSegmentedImage: false,
        url: null,
      });
    }

    if (path.length === 3 && path[2] === "mediapipe") {
      return json({
        success: true,
        hasLandmarks: Boolean(record.mediapipeLandmarks?.length),
        landmarks: record.mediapipeLandmarks ?? null,
      });
    }

    if (path.length === 2) {
      return json({
        success: true,
        face: {
          ...record,
          updatedAt: record.updatedAt ?? record.createdAt,
          userId: null,
          name: null,
          actionPlan: { title: null, items: [] },
          unlockStatus: {
            overall: true,
            harmony: true,
            dimorphism: true,
            features: true,
          },
        },
      });
    }
  }

  return json({ success: false, message: "Not found." }, 404);
}

export async function POST(req: Request, context: { params: Promise<Params> }) {
  const { path = [] } = await context.params;

  if (path[0] === "side-landmarks") {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return json({
        success: false,
        message: "server-side detection disabled in MVP",
      });
    }

    const body = (await req.json()) as {
      mediapipeLandmarks?: LandmarkInput;
      imageWidth: number;
      imageHeight: number;
    };
    const points = normalizeLandmarks(body.mediapipeLandmarks);
    const data = buildSideLandmarks(points, body.imageWidth, body.imageHeight);
    return json({ success: true, data });
  }

  if (path[0] === "background-removal") {
    const body = (await req.json()) as { image?: string; quality?: number };
    if (!body.image) {
      return json({ success: false, message: "Missing image." }, 400);
    }
    return json({
      success: true,
      image: body.image,
      contentType: "image/webp",
    });
  }

  if (path[0] === "faces" && path.length === 1) {
    const body = (await req.json()) as {
      frontPhotoUrl: string;
      sidePhotoUrl: string;
      frontPhotoSegmentedUrl?: string | null;
      sidePhotoSegmentedUrl?: string | null;
      frontLandmarks?: LandmarkInput;
      sideLandmarks?: LandmarkInput;
      mediapipeLandmarks?: LandmarkInput;
      frontQuality?: FaceRecord["frontQuality"];
      sideQuality?: FaceRecord["sideQuality"];
      manualLandmarks?: FaceRecord["manualLandmarks"];
      gender?: string;
      race?: string;
    };

    if (!body.frontPhotoUrl || !body.sidePhotoUrl) {
      return json({ success: false, message: "Missing image URLs." }, 400);
    }

    const frontLandmarks = normalizeLandmarks(body.frontLandmarks);
    const sideLandmarks = normalizeLandmarks(body.sideLandmarks);
    const mediapipeLandmarks = normalizeLandmarks(body.mediapipeLandmarks);

    const record = createFace({
      gender: body.gender ?? "unspecified",
      race: body.race ?? "unspecified",
      frontPhotoUrl: body.frontPhotoUrl,
      sidePhotoUrl: body.sidePhotoUrl,
      frontPhotoSegmentedUrl: body.frontPhotoSegmentedUrl ?? null,
      sidePhotoSegmentedUrl: body.sidePhotoSegmentedUrl ?? null,
      frontLandmarks,
      sideLandmarks,
      mediapipeLandmarks,
      frontQuality: body.frontQuality ?? null,
      sideQuality: body.sideQuality ?? null,
      manualLandmarks: body.manualLandmarks ?? null,
    });

    return json({
      success: true,
      face: {
        id: record.id,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt ?? record.createdAt,
        images: {
          frontUrl: record.frontPhotoUrl,
          sideUrl: record.sidePhotoUrl,
        },
      },
      faceId: record.id,
    });
  }

  if (path[0] === "faces" && path.length === 3 && path[2] === "mediapipe") {
    const id = path[1];
    const body = (await req.json()) as {
      kind?: "front" | "side";
      landmarks?: LandmarkInput;
    };
    if (body.landmarks == null) {
      return json({ success: false, message: "Missing landmarks." }, 400);
    }
    const kind = body.kind === "side" ? "side" : "front";
    const record = saveMediapipeLandmarks(id, body.landmarks, kind);
    if (!record) return json({ success: false, message: "Face not found." }, 404);
    return json({ success: true });
  }

  return json({ success: false, message: "Not found." }, 404);
}
