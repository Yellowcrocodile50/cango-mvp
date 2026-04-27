"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email || "");
        setName(user.user_metadata?.name || "");
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      data: { name },
    });

    if (error) {
      setMessage("저장에 실패했습니다: " + error.message);
    } else {
      setMessage("저장되었습니다.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">설정</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg">프로필 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#365927]">
                이메일
              </label>
              <Input value={email} disabled className="bg-muted" />
            </div>
            <div>
              <label className="text-sm font-medium text-[#365927]">
                이름
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="공급자 이름"
              />
            </div>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#365927] hover:bg-[#4a7a38]"
            >
              {saving ? "저장 중..." : "저장"}
            </Button>
            {message && (
              <p
                className={`text-sm ${
                  message.includes("실패") ? "text-red-500" : "text-green-600"
                }`}
              >
                {message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
