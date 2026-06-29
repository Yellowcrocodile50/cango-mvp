"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Upload, FileText, Image as ImageIcon, X } from "lucide-react";
import { categoryGroups, FREE_SUB_DISPLAY } from "@/data/categories";
import { toast } from "sonner";

const THUMBNAIL_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_MAX_COUNT = 2;

function thumbnailPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/thumbnails/";
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

interface Material {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  file_url: string | null;
  thumbnail_url: string | null;
  preview_images: string[] | null;
  created_at: string;
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null);
  const [isDraggingThumbnail, setIsDraggingThumbnail] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [previewPreviews, setPreviewPreviews] = useState<string[]>([]);
  const [existingPreviewUrls, setExistingPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);

  type SortKey = "created_at" | "price" | "title";
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedMaterials = useMemo(() => {
    const arr = [...materials];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "price") cmp = a.price - b.price;
      else if (sortKey === "title") cmp = a.title.localeCompare(b.title, "ko");
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [materials, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

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
    if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  function clearThumbnail() {
    if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
  }

  function addPreviewFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const currentCount = existingPreviewUrls.length + previewFiles.length;
    const remaining = PREVIEW_MAX_COUNT - currentCount;
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

  function removeExistingPreview(idx: number) {
    setExistingPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeNewPreviewFile(idx: number) {
    URL.revokeObjectURL(previewPreviews[idx]);
    setPreviewFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearPreviews() {
    previewPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPreviewFiles([]);
    setPreviewPreviews([]);
    setExistingPreviewUrls([]);
  }

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "기타" as string,
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  async function fetchMaterials() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("materials")
      .select("*")
      .eq("supplier_id", user.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    setMaterials(data || []);
    setLoading(false);
  }

  async function uploadPdf(userId: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${userId}/${fileName}`;

    const { error } = await supabase.storage
      .from("materials")
      .upload(filePath, file, { contentType: file.type });

    if (error) throw error;
    return filePath;
  }

  async function uploadThumbnail(userId: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop();
    const filePath = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(filePath, file, { contentType: file.type });

    if (error) throw error;

    const { data } = supabase.storage.from("thumbnails").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);

    try {
      let fileUrl: string | null = null;
      let thumbnailUrl: string | null = null;

      if (pdfFile) {
        const filePath = await uploadPdf(user.id, pdfFile);
        fileUrl = filePath;
      }

      if (thumbnailFile) {
        thumbnailUrl = await uploadThumbnail(user.id, thumbnailFile);
      }

      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        price: parseInt(form.price),
        category: form.category,
        supplier_id: user.id,
      };

      if (fileUrl) {
        payload.file_url = fileUrl;
      }

      if (thumbnailUrl) {
        payload.thumbnail_url = thumbnailUrl;

        if (editingId) {
          const oldPath = thumbnailPathFromUrl(existingThumbnailUrl);
          if (oldPath) {
            await supabase.storage.from("thumbnails").remove([oldPath]);
          }
        }
      }

      // 미리보기 이미지 업로드
      const uploadedPreviewUrls: string[] = [];
      if (previewFiles.length > 0) {
        const ts = Date.now();
        for (let i = 0; i < previewFiles.length; i++) {
          const f = previewFiles[i];
          const ext = f.name.split(".").pop();
          const path = `${user.id}/${ts}_preview${i + 1}.${ext}`;
          const { error } = await supabase.storage
            .from("thumbnails")
            .upload(path, f, { contentType: f.type });
          if (error) throw error;
          const { data } = supabase.storage.from("thumbnails").getPublicUrl(path);
          uploadedPreviewUrls.push(data.publicUrl);
        }
      }
      const finalPreviewUrls = [...existingPreviewUrls, ...uploadedPreviewUrls];
      payload.preview_images = finalPreviewUrls.length > 0 ? finalPreviewUrls : null;

      if (editingId) {
        await supabase.from("materials").update(payload).eq("id", editingId);
      } else {
        if (!pdfFile) {
          alert("PDF 파일을 선택해주세요.");
          setUploading(false);
          return;
        }
        await supabase.from("materials").insert(payload);
      }

      setForm({ title: "", description: "", price: "", category: "기타" });
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      clearThumbnail();
      setExistingThumbnailUrl(null);
      clearPreviews();
      setShowForm(false);
      setEditingId(null);
      fetchMaterials();
    } catch (err) {
      toast.error("업로드 중 오류가 발생했습니다: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await supabase.from("materials").update({ is_deleted: true }).eq("id", id);
    fetchMaterials();
  }

  function handleEdit(material: Material) {
    setForm({
      title: material.title,
      description: material.description || "",
      price: material.price.toString(),
      category: material.category || "기타",
    });
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    clearThumbnail();
    setExistingThumbnailUrl(material.thumbnail_url);
    if (material.thumbnail_url) {
      setThumbnailPreview(material.thumbnail_url);
    }
    clearPreviews();
    setExistingPreviewUrls(material.preview_images ?? []);
    setEditingId(material.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({ title: "", description: "", price: "", category: "기타" });
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    clearThumbnail();
    setExistingThumbnailUrl(null);
    clearPreviews();
    setShowForm(false);
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#365927]">내 자료 관리</h1>
        <Button
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
              setEditingId(null);
              setForm({ title: "", description: "", price: "", category: "기타" });
              setPdfFile(null);
              clearThumbnail();
              setExistingThumbnailUrl(null);
            }
          }}
          className="bg-[#365927] hover:bg-[#4a7a38]"
        >
          <Plus className="mr-1 h-4 w-4" />
          자료 등록
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "자료 수정" : "새 자료 등록"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[#365927]">
                  자료명
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="예: 2026 수시 합격 자기소개서 모음"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#365927]">
                  설명
                </label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="자료에 대한 간단한 설명"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#365927]">
                  가격 (원)
                </label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="10000"
                  required
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#365927]">
                  카테고리
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full h-10 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                >
                  {categoryGroups.flatMap((group) =>
                    group.subGroups
                      ? group.subGroups.map((sub) => (
                          <optgroup key={`${group.label}-${sub.label}`} label={`${group.label} › ${FREE_SUB_DISPLAY[sub.label] ?? sub.label}`}>
                            {sub.items.map((item) => (
                              <option key={item} value={item}>{item.startsWith("무료-") ? item.slice(3) : item}</option>
                            ))}
                          </optgroup>
                        ))
                      : [
                          <optgroup key={group.label} label={group.label}>
                            {group.items.map((item) => (
                              <option key={item} value={item}>{item.startsWith("무료-") ? item.slice(3) : item}</option>
                            ))}
                          </optgroup>,
                        ]
                  )}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#365927]">
                  PDF 파일 {editingId && "(변경 시에만 선택)"}
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
                    if (
                      e.currentTarget.contains(e.relatedTarget as Node | null)
                    )
                      return;
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) validateAndSetPdf(file);
                  }}
                  className={`relative mt-1 border-2 border-dashed rounded-lg p-6 text-center transition ${
                    isDragging
                      ? "border-[#365927] bg-[#f5f9f4]"
                      : "border-[#d6e4d3] hover:border-[#365927] hover:bg-[#f5f9f4]"
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
                        <span className="text-sm font-medium">
                          {pdfFile.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({(pdfFile.size / 1024 / 1024).toFixed(1)}MB)
                        </span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">
                          {isDragging
                            ? "여기에 파일을 놓으세요"
                            : "클릭하거나 PDF 파일을 드래그하세요"}
                        </p>
                        <p className="text-xs mt-1">최대 50MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#365927]">
                  썸네일 이미지{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (선택 · 권장 800×800px 정사각형, 최대 5MB)
                  </span>
                </label>
                {thumbnailPreview ? (
                  <div className="mt-1 flex items-center gap-3 border border-[#d6e4d3] rounded-lg p-3 bg-[#fafcf9]">
                    <img
                      src={thumbnailPreview}
                      alt="썸네일 미리보기"
                      className="w-20 h-24 object-cover rounded border border-[#d6e4d3]"
                    />
                    <div className="flex-1 min-w-0">
                      {thumbnailFile ? (
                        <>
                          <p className="text-sm text-[#365927] truncate">
                            {thumbnailFile.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(thumbnailFile.size / 1024 / 1024).toFixed(2)}MB ·
                            새 이미지
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-[#5a7d50]">
                          현재 등록된 썸네일
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearThumbnail}
                    >
                      <X className="h-3 w-3" />
                    </Button>
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
                      if (
                        e.currentTarget.contains(e.relatedTarget as Node | null)
                      )
                        return;
                      setIsDraggingThumbnail(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingThumbnail(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) validateAndSetThumbnail(file);
                    }}
                    className={`relative mt-1 border-2 border-dashed rounded-lg p-4 text-center transition ${
                      isDraggingThumbnail
                        ? "border-[#365927] bg-[#f5f9f4]"
                        : "border-[#d6e4d3] hover:border-[#365927] hover:bg-[#f5f9f4]"
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
                    <div className="pointer-events-none text-muted-foreground">
                      <ImageIcon className="h-6 w-6 mx-auto mb-1" />
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
                <label className="text-sm font-medium text-[#365927]">
                  미리보기 이미지{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (선택 · 최대 {PREVIEW_MAX_COUNT}장 · 5MB 이하)
                  </span>
                </label>
                {(existingPreviewUrls.length > 0 || previewPreviews.length > 0) && (
                  <div className="mt-2 flex gap-3 flex-wrap mb-3">
                    {existingPreviewUrls.map((url, idx) => (
                      <div key={`existing-${idx}`} className="relative">
                        <img
                          src={url}
                          alt={`미리보기 ${idx + 1}`}
                          className="w-20 h-28 object-cover rounded border border-[#d6e4d3]"
                        />
                        <span className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                          {idx + 1}p
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 rounded-full"
                          onClick={() => removeExistingPreview(idx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {previewPreviews.map((src, idx) => (
                      <div key={`new-${idx}`} className="relative">
                        <img
                          src={src}
                          alt={`새 미리보기 ${idx + 1}`}
                          className="w-20 h-28 object-cover rounded border border-[#365927]"
                        />
                        <span className="absolute top-1 left-1 bg-[#365927]/70 text-white text-xs px-1 rounded">
                          {existingPreviewUrls.length + idx + 1}p
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 rounded-full"
                          onClick={() => removeNewPreviewFile(idx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {existingPreviewUrls.length + previewFiles.length < PREVIEW_MAX_COUNT && (
                  <div className="relative mt-1 border-2 border-dashed border-[#d6e4d3] hover:border-[#365927] hover:bg-[#f5f9f4] rounded-lg p-4 text-center transition">
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
                    <div className="pointer-events-none text-muted-foreground">
                      <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                      <p className="text-sm">클릭하여 미리보기 이미지 추가</p>
                      <p className="text-xs mt-0.5">
                        {existingPreviewUrls.length + previewFiles.length}/{PREVIEW_MAX_COUNT}장 등록됨
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={uploading}
                  className="bg-[#365927] hover:bg-[#4a7a38]"
                >
                  {uploading
                    ? "업로드 중..."
                    : editingId
                    ? "수정"
                    : "등록"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                >
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">등록된 자료</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              로딩 중...
            </p>
          ) : materials.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              등록된 자료가 없습니다. 첫 자료를 등록해보세요!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("title")}
                  >
                    자료명{sortArrow("title")}
                  </TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("price")}
                  >
                    가격{sortArrow("price")}
                  </TableHead>
                  <TableHead>파일</TableHead>
                  <TableHead
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("created_at")}
                  >
                    등록일{sortArrow("created_at")}
                  </TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMaterials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.category || "기타"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {m.description || "-"}
                    </TableCell>
                    <TableCell>{m.price.toLocaleString()}원</TableCell>
                    <TableCell>
                      {m.file_url ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          <FileText className="h-3 w-3 mr-1" />
                          업로드됨
                        </Badge>
                      ) : (
                        <Badge variant="secondary">없음</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(m.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(m)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(m.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
