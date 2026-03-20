import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #17191D 0%, #0B0B0C 100%)",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: 36,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 10,
            borderRadius: 28,
            border: "2px solid rgba(124, 143, 163, 0.75)",
          }}
        />
        <div
          style={{
            display: "flex",
            color: "#F3F1EC",
            fontSize: 100,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.08em",
            fontFamily: "Georgia, serif",
            transform: "translateX(-6px)",
          }}
        >
          D
        </div>
        <div
          style={{
            position: "absolute",
            right: 38,
            top: 46,
            width: 28,
            height: 6,
            borderRadius: 999,
            background: "linear-gradient(90deg, #91A3B5 0%, #7C8FA3 100%)",
          }}
        />
      </div>
    ),
    size
  );
}
