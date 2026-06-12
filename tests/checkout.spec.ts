import { test, expect, type Page } from "@playwright/test";

const PRODUCT_ID = "2bbd3290-691c-49c2-9f74-6f28a6167380";
const PRODUCT_TITLE = "갓반고, 자사고에서 살아남기";
const PRODUCT_PRICE = "5,000원";
const TEST_USER = "student";
const TEST_PASS = "test12@3";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="text"]', TEST_USER);
  await page.fill('input[type="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL("/", { timeout: 15000 });
}

async function goToCheckout(page: Page) {
  // 제품 페이지에서 "바로 구매하기" 클릭 → 장바구니 추가 후 /checkout 이동
  await page.goto(`/product/${PRODUCT_ID}`);
  await page.waitForSelector('button:has-text("바로 구매하기")', { timeout: 10000 });
  await page.click('button:has-text("바로 구매하기")');
  await page.waitForURL("/checkout", { timeout: 10000 });
}

test.describe("포트원 결제 플로우", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("1. 체크아웃 페이지 렌더링", async ({ page }) => {
    await goToCheckout(page);

    await expect(page.locator("h1")).toContainText("결제하기");
    await expect(page.getByText(PRODUCT_TITLE)).toBeVisible();
    await expect(page.getByText(PRODUCT_PRICE)).toBeVisible();
    await expect(page.locator('button:has-text("신용/체크카드")')).toBeVisible();
    await expect(page.locator('button:has-text("카카오페이")')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText("결제하기");
  });

  test("2. 결제 수단 선택 전환", async ({ page }) => {
    await goToCheckout(page);

    const cardBtn = page.locator('button:has-text("신용/체크카드")');
    const kakaoBtn = page.locator('button:has-text("카카오페이")');

    // 기본값: 카드 선택됨
    await expect(cardBtn).toHaveClass(/border-\[#365927\]/);

    // 카카오페이 선택
    await kakaoBtn.click();
    await expect(kakaoBtn).toHaveClass(/border-\[#365927\]/);
    await expect(cardBtn).not.toHaveClass(/bg-\[#eaf2e8\]/);

    // 다시 카드 선택
    await cardBtn.click();
    await expect(cardBtn).toHaveClass(/border-\[#365927\]/);
  });

  test("3. 포트원 결제 팝업 열림 (카드)", async ({ page, context }) => {
    await goToCheckout(page);

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();

    // 결제 버튼 클릭 → 포트원 팝업 대기
    const [popup] = await Promise.all([
      context.waitForEvent("page", { timeout: 20000 }),
      submitBtn.click(),
    ]);

    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toContain("portone");

    await popup.screenshot({ path: "test-results/portone-card-popup.png" });
    console.log("✅ 포트원 카드 결제 팝업 URL:", popup.url());

    // 팝업 닫기 (결제 취소 시뮬레이션)
    await popup.close();

    // 취소 후 에러 toast 확인
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 8000 });
  });

  test("4. 포트원 결제 팝업 열림 (카카오페이)", async ({ page, context }) => {
    await goToCheckout(page);

    await page.click('button:has-text("카카오페이")');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();

    const [popup] = await Promise.all([
      context.waitForEvent("page", { timeout: 20000 }),
      submitBtn.click(),
    ]);

    await popup.waitForLoadState("domcontentloaded");
    await popup.screenshot({ path: "test-results/portone-kakao-popup.png" });
    console.log("✅ 포트원 카카오페이 팝업 URL:", popup.url());

    await popup.close();
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 8000 });
  });

  test("5. 결제 성공 페이지 (API mock)", async ({ page }) => {
    await page.route("/api/confirm", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, materialIds: [PRODUCT_ID] }),
      });
    });

    await page.goto(`/checkout/success?paymentId=test-order-${Date.now()}`);

    await expect(page.locator("h1")).toContainText("구매가 완료되었습니다", { timeout: 10000 });
    await expect(page.getByRole("link", { name: "마이페이지 보기" })).toBeVisible();
    await expect(page.getByRole("link", { name: "홈으로 돌아가기" })).toBeVisible();
  });

  test("6. 결제 확인 API 실패 처리", async ({ page }) => {
    await page.route("/api/confirm", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "결제가 완료되지 않았습니다." }),
      });
    });

    await page.goto(`/checkout/success?paymentId=test-order-${Date.now()}`);

    await expect(page.locator("h1")).toContainText("결제 오류", { timeout: 10000 });
    await expect(page.getByText("결제가 완료되지 않았습니다.")).toBeVisible();
    await expect(page.getByRole("link", { name: "다시 시도하기" })).toBeVisible();
  });

  test("7. 포트원 리다이렉트 취소 처리", async ({ page }) => {
    await page.goto(
      "/checkout/success?code=PAY_PROCESS_CANCELED&message=사용자가%20결제를%20취소하였습니다."
    );

    await expect(page.locator("h1")).toContainText("결제 오류");
    await expect(page.getByText("사용자가 결제를 취소하였습니다.")).toBeVisible();
  });
});
