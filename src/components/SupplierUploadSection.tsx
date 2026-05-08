"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, FileText, Plus, X, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { categoryGroups } from "@/data/categories";
import { toast } from "sonner";

const THUMBNAIL_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_MAX_COUNT = 2;

interface Material {
  id: string;
  title: string;
  price: number;
  file_url: string | null;
  created_at: string;
}

export default function SupplierUploadSection({
  userId,
  onUploaded,
}: {
  userId: string;
  onUploaded?: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isDraggingThumbnail, setIsDraggingThumbnail] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [previewPreviews, setPreviewPreviews] = useState<string[]>([]);
  const [recentMaterials, setRecentMaterials] = useState<Material[]>([]);
  const [loaded, setLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

  function validateAndSetPdf(file: File) {
    if (file.type !== "application/pdf") {
      alert("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("파일 크기는 50MB 이하여야 합니다.");
      return;
    }
    setPdfFile(file);
  }

  function validateAndSetThumbnail(file: File) {
    if (!THUMBNAIL_MIME_TYPES.includes(file.type)) {
      alert("썸네일은 JPG, PNG, WebP 이미지만 가능합니다.");
      return;
    }
    if (file.size > THUMBNAIL_MAX_BYTES) {
      alert("썸네일 크기는 5MB 이하여야 합니다.");
      return;
    }
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  function clearThumbnail() {
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  }

  function addPreviewFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const remaining = PREVIEW_MAX_COUNT - previewFiles.length;
    if (remaining <= 0) return;
    const toAdd = arr.slice(0, remaining);
    const invalid = toAdd.filter(
      (f) => !THUMBNAIL_MIME_TYPES.includes(f.type) || f.size > THUMBNAIL_MAX_BYTES
    );
    if (invalid.length > 0) {
      alert("미리보기 이미지는 JPG/PNG/WebP, 5MB 이하여야 합니다.");
      return;
    }
    setPreviewFiles((prev) => [...prev, ...toAdd]);
    setPreviewPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    if (previewInputRef.current) previewInputRef.current.value = "";
  }

  function removePreviewFile(idx: number) {
    URL.revokeObjectURL(previewPreviews[idx]);
    setPreviewFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewPreviews((prev) => prev.filter((_, i) => i !== idx));
  }
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "기타",
  });

  async function loadRecent() {
    if (loaded) return;
    const { data } = await supabase
      .from("materials")
      .select("id, title, price, file_url, created_at")
      .eq("supplier_id", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(4);
    setRecentMaterials(data || []);
    setLoaded(true);
  }

  // Load on mount
  if (!loaded) loadRecent();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) {
      alert("PDF 파일을 선택해주세요.");
      return;
    }

    setUploading(true);
    try {
      const ext = pdfFile.name.split(".").pop();
      const baseName = `${userId}/${Date.now()}`;
      const filePath = `${baseName}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("materials")
        .upload(filePath, pdfFile, { contentType: pdfFile.type });

      if (uploadError) throw uploadError;

      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        const thumbExt = thumbnailFile.name.split(".").pop();
        const thumbPath = `${baseName}.${thumbExt}`;

        const { error: thumbError } = await supabase.storage
          .from("thumbnails")
          .upload(thumbPath, thumbnailFile, {
            contentType: thumbnailFile.type,
          });

        if (thumbError) throw thumbError;

        const { data: publicData } = supabase.storage
          .from("thumbnails")
          .getPublicUrl(thumbPath);
        thumbnailUrl = publicData.publicUrl;
      }

      let previewUrls: string[] | null = null;
      if (previewFiles.length > 0) {
        const urls: string[] = [];
        for (let i = 0; i < previewFiles.length; i++) {
          const f = previewFiles[i];
          const ext = f.name.split(".").pop();
          const path = `${baseName}_preview${i + 1}.${ext}`;
          const { error } = await supabase.storage
            .from("thumbnails")
            .upload(path, f, { contentType: f.type });
          if (error) throw error;
          const { data } = supabase.storage.from("thumbnails").getPublicUrl(path);
          urls.push(data.publicUrl);
        }
        previewUrls = urls;
      }

      const { error: insertError } = await supabase.from("materials").insert({
        title: form.title,
        description: form.description || null,
        price: parseInt(form.price),
        category: form.category,
        file_url: filePath,
        thumbnail_url: thumbnailUrl,
        preview_images: previewUrls,
        supplier_id: userId,
      });

      if (insertError) throw insertError;

      setForm({ title: "", description: "", price: "", category: "기타" });
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      clearThumbnail();
      previewPreviews.forEach((url) => URL.revokeObjectURL(url));
      setPreviewFiles([]);
      setPreviewPreviews([]);
      setShowForm(false);
      setLoaded(false);
      onUploaded?.();
    } catch (err) {
      toast.error("업로드 중 오류가 발생했습니다: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mb-10 bg-white border border-[#d6e4d3] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#365927]">내 자료 관리</h2>
          <p className="text-sm text-[#5a7d50]">
            새 PDF 자료를 등록하거나 최근 등록한 자료를 확인하세요
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-4 py-2 bg-[#365927] text-white rounded-lg text-sm font-medium hover:bg-[#4a7a38] transition cursor-pointer"
          >
            {showForm ? (
              <>
                <X className="h-4 w-4" /> 닫기
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> 새 자료 등록
              </>
            )}
          </button>
          <Link
            href="/supplier"
            className="flex items-center px-4 py-2 border border-[#d6e4d3] text-[#365927] rounded-lg text-sm font-medium hover:bg-[#f5f9f4] transition"
          >
            대시보드
          </Link>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-[#d6e4d3] rounded-xl p-5 mb-5 bg-[#fafcf9] space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#365927] mb-1">
                자료명
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 2026 수시 합격 자기소개서 모음"
                required
                className="w-full h-10 px-3 border border-[#d6e4d3] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#365927] mb-1">
                가격 (원)
              </label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="5000"
                required
                min="0"
                className="w-full h-10 px-3 border border-[#d6e4d3] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#365927] mb-1">
              카테고리
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full h-10 px-3 border border-[#d6e4d3] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
            >
              {categoryGroups.flatMap((group) =>
                group.subGroups
                  ? group.subGroups.map((sub) => (
                      <optgroup key={`${group.label}-${sub.label}`} label={`${group.label} › ${sub.label}`}>
                        {sub.items.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </optgroup>
                    ))
                  : [
                      <optgroup key={group.label} label={group.label}>
                        {group.items.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </optgroup>,
                    ]
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#365927] mb-1">
              설명
            </label>
            <input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="자료에 대한 간단한 설명"
              className="w-full h-10 px-3 border border-[#d6e4d3] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#365927] mb-1">
              PDF 파일
            </label>
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (e.currentTarget.contains(e.relatedTarget as Node | null))
                  return;
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) validateAndSetPdf(file);
              }}
              className={`relative border-2 border-dashed rounded-lg p-5 text-center transition ${
                isDragging
                  ? "border-[#365927] bg-white"
                  : "border-[#d6e4d3] hover:border-[#365927] hover:bg-white"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) validateAndSetPdf(file);
                  e.target.value = "";
                }}
              />
              <div className="pointer-events-none">
                {pdfFile ? (
                  <div className="flex items-center justify-center gap-2 text-[#365927]">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm font-medium">{pdfFile.name}</span>
                    <span className="text-xs text-[#5a7d50]">
                      ({(pdfFile.size / 1024 / 1024).toFixed(1)}MB)
                    </span>
                  </div>
                ) : (
                  <div className="text-[#8aab82]">
                    <Upload className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-sm">
                      {isDragging
                        ? "여기에 파일을 놓으세요"
                        : "클릭하거나 PDF 파일을 드래그하세요"}
                    </p>
                    <p className="text-xs mt-0.5">최대 50MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#365927] mb-1">
              썸네일 이미지 <span className="text-xs font-normal text-[#8aab82]">(선택 · 권장 800×800px 정사각형, 최대 5MB)</span>
            </label>
            {thumbnailPreview ? (
              <div className="flex items-center gap-3 border border-[#d6e4d3] rounded-lg p-3 bg-white">
                <img
                  src={thumbnailPreview}
                  alt="썸네일 미리보기"
                  className="w-16 h-20 object-cover rounded border border-[#d6e4d3]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#365927] truncate">
                    {thumbnailFile?.name}
                  </p>
                  <p className="text-xs text-[#5a7d50]">
                    {((thumbnailFile?.size || 0) / 1024 / 1024).toFixed(2)}MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearThumbnail}
                  className="p-1.5 text-[#5a7d50] hover:text-[#365927] hover:bg-[#f5f9f4] rounded transition cursor-pointer"
                  aria-label="썸네일 제거"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDraggingThumbnail(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingThumbnail(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (e.currentTarget.contains(e.relatedTarget as Node | null))
                    return;
                  setIsDraggingThumbnail(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingThumbnail(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) validateAndSetThumbnail(file);
                }}
                className={`relative border-2 border-dashed rounded-lg p-4 text-center transition ${
                  isDraggingThumbnail
                    ? "border-[#365927] bg-white"
                    : "border-[#d6e4d3] hover:border-[#365927] hover:bg-white"
                }`}
              >
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) validateAndSetThumbnail(file);
                    e.target.value = "";
                  }}
                />
                <div className="pointer-events-none text-[#8aab82]">
                  <ImageIcon className="h-5 w-5 mx-auto mb-1" />
                  <p className="text-sm">
                    {isDraggingThumbnail
                      ? "여기에 이미지를 놓으세요"
                      : "클릭하거나 이미지를 드래그하세요"}
                  </p>
                  <p className="text-xs mt-0.5">JPG · PNG · WebP</p>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#365927] mb-1">
              미리보기 이미지 <span className="text-xs font-normal text-[#8aab82]">(선택 · 최대 {PREVIEW_MAX_COUNT}장 · 5MB 이하)</span>
            </label>
            {previewPreviews.length > 0 && (
              <div className="flex gap-3 mb-3 flex-wrap">
                {previewPreviews.map((src, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={src}
                      alt={`미리보기 ${idx + 1}`}
                      className="w-20 h-28 object-cover rounded border border-[#d6e4d3]"
                    />
                    <span className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                      {idx + 1}p
                    </span>
                    <button
                      type="button"
                      onClick={() => removePreviewFile(idx)}
                      className="absolute -top-1.5 -right-1.5 bg-white border border-[#d6e4d3] rounded-full p-0.5 text-[#5a7d50] hover:text-[#365927] cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {previewFiles.length < PREVIEW_MAX_COUNT && (
              <div className="relative border-2 border-dashed border-[#d6e4d3] hover:border-[#365927] hover:bg-white rounded-lg p-4 text-center transition">
                <input
                  ref={previewInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.files) addPreviewFiles(e.target.files);
                  }}
                />
                <div className="pointer-events-none text-[#8aab82]">
                  <ImageIcon className="h-5 w-5 mx-auto mb-1" />
                  <p className="text-sm">클릭하여 미리보기 이미지 추가</p>
                  <p className="text-xs mt-0.5">{previewFiles.length}/{PREVIEW_MAX_COUNT}장 등록됨</p>
                </div>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2 bg-[#365927] text-white rounded-lg text-sm font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "업로드 중..." : "등록하기"}
          </button>
        </form>
      )}

      {/* 최근 등록 자료 */}
      {recentMaterials.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[#5a7d50] mb-3">
            최근 등록한 자료
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {recentMaterials.map((m) => (
              <div
                key={m.id}
                className="border border-[#d6e4d3] rounded-lg p-3 bg-[#fafcf9]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-[#5a7d50] shrink-0" />
                  <span className="text-sm font-medium text-[#1a2e16] truncate">
                    {m.title}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#365927]">
                    {m.price.toLocaleString()}원
                  </span>
                  {m.file_url ? (
                    <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                      업로드됨
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">파일 없음</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
