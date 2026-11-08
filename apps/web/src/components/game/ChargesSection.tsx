import {
  type Charge,
  cents,
  type Game,
  type PlayerSeatTime,
  type WageRule,
} from "@holdem-knight/core";
import { chargesByPlayer, formatSeatTime } from "@/lib/charges";
import { formatGameMoney } from "@/lib/currency";

function wageSummary(rule: WageRule, money: (value: number) => string) {
  const base = `${money(rule.hourly)}/小时`;
  const { adjustment } = rule;
  if (!adjustment) return base;
  const other = `${money(adjustment.hourly)}/小时`;
  return adjustment.kind === "time_of_day"
    ? `${base}，${adjustment.fromHour} 点到 ${adjustment.toHour} 点 ${other}`
    : `${base}，开局 ${adjustment.afterHours} 小时后 ${other}`;
}

interface ChargesSectionProps {
  game: Pick<Game, "currency" | "tableFee" | "wage">;
  charges: readonly Charge[];
  seatTimes: readonly PlayerSeatTime[];
  total: number;
  recipientName: string;
  nameOf: (playerId: string) => string;
}

/**
 * The table fee and wages, apart from the chip results. Each player's row is where waiving or
 * changing a charge will go.
 */
export function ChargesSection({
  game,
  charges,
  seatTimes,
  total,
  recipientName,
  nameOf,
}: ChargesSectionProps) {
  const { currency, tableFee, wage } = game;
  const money = (value: number) => formatGameMoney(cents(value), currency);
  const byPlayer = chargesByPlayer(charges);

  return (
    <section className="mt-4 rounded-xl border border-line bg-surface px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">台费和工资</h2>
        <span className="shrink-0 text-sm text-muted">
          共 <span className="font-semibold text-win">{money(total)}</span>，计入{recipientName}
        </span>
      </div>
      <ul className="mt-1 text-sm text-muted">
        {tableFee && (
          <li>
            台费 每人 {money(tableFee.amount)}
            {tableFee.minMinutes > 0 ? `，在桌满 ${tableFee.minMinutes} 分钟才收` : ""}
          </li>
        )}
        {wage && <li>工资 {wageSummary(wage, money)}</li>}
      </ul>
      <table className="mt-2 w-full table-fixed text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th scope="col" className="py-2 text-left font-medium">
              玩家
            </th>
            <th scope="col" className="w-20 text-right font-medium">
              在桌
            </th>
            {tableFee && (
              <th scope="col" className="w-16 text-right font-medium">
                台费
              </th>
            )}
            {wage && (
              <th scope="col" className="w-16 text-right font-medium">
                工资
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {seatTimes.map(({ playerId, seatedMs }) => {
            const owed = byPlayer.get(playerId) ?? { tableFee: 0, wage: 0 };
            return (
              <tr key={playerId} className="h-11 border-t border-line tabular-nums">
                <th scope="row" className="truncate text-left font-medium">
                  {nameOf(playerId)}
                </th>
                <td className="text-right text-muted">{formatSeatTime(seatedMs)}</td>
                {tableFee && (
                  <td className="text-right">
                    {owed.tableFee === 0 ? (
                      <span className="text-xs text-muted">未满时长</span>
                    ) : (
                      money(owed.tableFee)
                    )}
                  </td>
                )}
                {wage && <td className="text-right">{money(owed.wage)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
