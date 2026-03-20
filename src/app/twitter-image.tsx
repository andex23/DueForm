import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #17191D 0%, #0B0B0C 100%)",
          color: "#F3F1EC",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 30,
            borderRadius: 24,
            border: "1px solid rgba(124, 143, 163, 0.24)",
          }}
        />
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "56px 64px",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 18,
                border: "1px solid rgba(124, 143, 163, 0.48)",
                background: "rgba(26, 33, 40, 0.72)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 48,
                  fontWeight: 800,
                  letterSpacing: "-0.08em",
                  fontFamily: "Georgia, serif",
                  transform: "translateX(-3px)",
                }}
              >
                D
              </div>
              <div
                style={{
                  position: "absolute",
                  right: 15,
                  top: 20,
                  width: 14,
                  height: 4,
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, #91A3B5 0%, #7C8FA3 100%)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#A7ADB7",
                }}
              >
                DueForm
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: "#A7ADB7",
                }}
              >
                Create invoices, send PDFs, track payments.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              maxWidth: 940,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 86,
                lineHeight: 0.94,
                letterSpacing: "-0.07em",
                fontWeight: 700,
                fontFamily: "Georgia, serif",
              }}
            >
              Premium invoicing
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 86,
                lineHeight: 0.94,
                letterSpacing: "-0.07em",
                fontWeight: 700,
                fontFamily: "Georgia, serif",
              }}
            >
              built for real work.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                lineHeight: 1.45,
                color: "#A7ADB7",
                maxWidth: 880,
              }}
            >
              Public invoice links, credits and offsets, payment tracking,
              reminders, and client-ready documents in one calm workspace.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 18,
            }}
          >
            {["Saved clients", "Credits & offsets", "Payment tracking"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    padding: "14px 18px",
                    borderRadius: 12,
                    border: "1px solid rgba(124, 143, 163, 0.22)",
                    background: "rgba(26, 33, 40, 0.68)",
                    color: "#F3F1EC",
                    fontSize: 22,
                  }}
                >
                  {label}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    ),
    size
  );
}
