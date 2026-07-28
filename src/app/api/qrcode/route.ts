import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

// ─── GET /api/qrcode ─────────────────────────────────────────────────────────
// Generate a QR code image as a PNG data URL
// Query params:
//   data (required) — the URL or string to encode
//   size (optional) — image size in pixels, default 300

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const data = searchParams.get("data");
    const sizeParam = searchParams.get("size");

    if (!data) {
      return NextResponse.json(
        { error: "The 'data' query parameter is required" },
        { status: 400 }
      );
    }

    const size = sizeParam ? parseInt(sizeParam, 10) : 300;

    // Validate size
    if (isNaN(size) || size < 50 || size > 1000) {
      return NextResponse.json(
        { error: "Size must be a number between 50 and 1000" },
        { status: 400 }
      );
    }

    // Generate QR code as data URL with wedding palette
    const qrDataUrl: string = await QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      color: {
        dark: "#1A1410",  // Espresso — the dark modules
        light: "#FBF6EE", // Champagne — the light background
      },
      errorCorrectionLevel: "M",
    });

    return NextResponse.json({
      success: true,
      qr: qrDataUrl,
      meta: {
        data,
        size,
        colors: {
          dark: "#1A1410",
          light: "#FBF6EE",
        },
      },
    });
  } catch (error) {
    console.error("[QRCODE GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate QR code" },
      { status: 500 }
    );
  }
}
