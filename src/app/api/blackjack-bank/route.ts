import { anyApi } from "convex/server";

import { getSessionUser } from "@/lib/auth/server";
import { isConvexConfigured, runConvexFunction } from "@/lib/convex-server";
import { blackjackBankSchema } from "@/lib/schemas";
import { json } from "@/lib/utils";

const DEFAULT_BLACKJACK_BANK = 100;

function normalizeBlackjackBank(bank: number | null | undefined) {
  if (typeof bank !== "number" || !Number.isFinite(bank) || bank < 0) {
    return DEFAULT_BLACKJACK_BANK;
  }

  return Math.floor(bank);
}

export async function GET() {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !isConvexConfigured()) {
    return json({ bank: DEFAULT_BLACKJACK_BANK });
  }

  const savedBank = await runConvexFunction(anyApi.preferences.getBlackjackBank, {
    userId: sessionUser.userId,
  });
  const bank = normalizeBlackjackBank(savedBank);

  if (bank !== savedBank) {
    await runConvexFunction(anyApi.preferences.upsertBlackjackBank, {
      userId: sessionUser.userId,
      blackjackBank: bank,
    });
  }

  return json({ bank });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !isConvexConfigured()) {
    return json({ status: "skipped" });
  }

  const payload = blackjackBankSchema.safeParse(await request.json());
  if (!payload.success) {
    return json({ error: "Invalid bank payload." }, { status: 400 });
  }

  await runConvexFunction(anyApi.preferences.upsertBlackjackBank, {
    userId: sessionUser.userId,
    blackjackBank: payload.data.bank,
  });

  return json({ status: "saved" });
}
