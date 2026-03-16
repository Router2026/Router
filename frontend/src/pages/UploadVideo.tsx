import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "../api";

const REGIONS = [
  "גולן",
  "גליל עליון",
  "גליל תחתון",
  "כרמל",
  "מרכז",
  "ירושלים",
  "דרום",
  "אילת",
];

export default function UploadVideo() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    region: "",
    description: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (f.type.startsWith("video/")) {
        setPreview(URL.createObjectURL(f));
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.region) return;
    setLoading(true);
    const fileUrl = file
      ? (await base44.integrations.Core.UploadFile({ file })).file_url
      : "";
    await base44.entities.VideoPost.create({ ...formData, video_url: fileUrl });
    navigate("/CommunityVideos");
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", width: "100%" }}>
      {/* Header (Full Width) */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          width: "100%",
        }}
      >
        {/* Header Content (Centered) */}
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a2e2a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#1a2e2a",
              flex: 1,
              textAlign: "right",
              margin: 0,
            }}
          >
            העלאת וידאו
          </h1>
        </div>
      </div>

      {/* Main Content (Centered & Constrained) */}
      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          padding: "20px 16px",
          paddingBottom: 100,
        }}
      >
        {/* Upload Area */}
        <label
          style={{ cursor: "pointer", display: "block", marginBottom: 16 }}
        >
          <input
            type="file"
            accept="video/*,image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div
            style={{
              border: "2px dashed #0d9e6e",
              borderRadius: 20,
              background: file ? "#f0fdf8" : "#fff",
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            {preview ? (
              <video
                src={preview}
                controls
                style={{ maxHeight: 200, width: "100%", borderRadius: 12 }}
              />
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎥</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#0d9e6e",
                    marginBottom: 6,
                  }}
                >
                  {file ? file.name : "לחץ להעלאת וידאו"}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  MP4, MOV, AVI עד 100MB
                </div>
              </>
            )}
          </div>
        </label>

        {/* Form Fields */}
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "20px",
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#1a2e2a",
              marginBottom: 16,
              textAlign: "right",
              margin: "0 0 16px 0",
            }}
          >
            פרטי הסרטון
          </h3>

          <label
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#64748b",
              display: "block",
              marginBottom: 6,
              textAlign: "right",
            }}
          >
            כותרת
          </label>
          <input
            value={formData.title}
            onChange={(e) =>
              setFormData((p) => ({ ...p, title: e.target.value }))
            }
            placeholder="כותרת הסרטון..."
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "2px solid #e2e8f0",
              borderRadius: 12,
              fontSize: 15,
              marginBottom: 16,
              boxSizing: "border-box",
              fontFamily: "Heebo, sans-serif",
              textAlign: "right",
              outline: "none",
            }}
          />

          <label
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#64748b",
              display: "block",
              marginBottom: 10,
              textAlign: "right",
            }}
          >
            אזור
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              marginBottom: 16,
              direction: "rtl",
            }}
          >
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setFormData((p) => ({ ...p, region: r }))}
                style={{
                  padding: "8px 4px",
                  border: `2px solid ${formData.region === r ? "#0d9e6e" : "#e2e8f0"}`,
                  borderRadius: 10,
                  background: formData.region === r ? "#f0fdf8" : "#fff",
                  color: formData.region === r ? "#0d9e6e" : "#64748b",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Heebo, sans-serif",
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <label
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#64748b",
              display: "block",
              marginBottom: 6,
              textAlign: "right",
            }}
          >
            תיאור
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData((p) => ({ ...p, description: e.target.value }))
            }
            placeholder="תאר את הסרטון..."
            rows={3}
            style={{
              width: "100%",
              padding: "12px",
              border: "2px solid #e2e8f0",
              boxSizing: "border-box",
              borderRadius: 12,
              fontSize: 14,
              fontFamily: "Heebo, sans-serif",
              textAlign: "right",
              resize: "none",
              outline: "none",
            }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !formData.title || !formData.region}
          style={{
            width: "100%",
            padding: "16px",
            border: "none",
            borderRadius: 16,
            background:
              formData.title && formData.region
                ? "linear-gradient(135deg, #7c3aed, #9333ea)"
                : "#e2e8f0",
            color: formData.title && formData.region ? "#fff" : "#94a3b8",
            fontSize: 16,
            fontWeight: 800,
            cursor:
              formData.title && formData.region ? "pointer" : "not-allowed",
            fontFamily: "Heebo, sans-serif",
          }}
        >
          {loading ? "מעלה..." : "🎬 פרסם סרטון (+30 XP)"}
        </button>
      </div>
    </div>
  );
}
