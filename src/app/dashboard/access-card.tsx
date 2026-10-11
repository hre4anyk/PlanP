import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessPrice, getGrantsForOwner } from "@/lib/access";
import { EXPLORER_URL } from "@/lib/stellar";
import { supabase } from "@/lib/supabase";
import { AccessPriceForm } from "./access-price-form";

export async function AccessCard({ userId }: { userId: string }) {
  const [price, grants] = await Promise.all([getAccessPrice(userId), getGrantsForOwner(userId)]);
  const { data: buyers } = grants.length
    ? await supabase
        .from("profiles")
        .select("user_id, first_name")
        .in("user_id", grants.map((g) => g.requester_id))
    : { data: [] };
  const nameOf = new Map((buyers ?? []).map((b) => [b.user_id, b.first_name?.split(/\s+/)[0] ?? "Someone"]));
  const earned = grants.reduce((sum, g) => sum + g.price, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile access</CardTitle>
        <CardDescription>
          Your card is public. The rest costs your price — paid in ACDC, straight to your wallet. Access is permanent.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <AccessPriceForm price={price} />
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Unlocked by {grants.length} {grants.length === 1 ? "person" : "people"} · earned {earned} ACDC
          </p>
          {grants.length > 0 && (
            <ul className="flex flex-col divide-y divide-border border-t border-border text-sm">
              {grants.map((g) => (
                <li key={g.requester_id} className="flex items-center justify-between gap-3 py-2.5">
                  <span>{nameOf.get(g.requester_id) ?? "Someone"}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span className="tabular-nums text-success">+{g.price} ACDC</span>
                    {g.tx_hash && (
                      <a href={`${EXPLORER_URL}/tx/${g.tx_hash}`} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
                        tx ↗
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
