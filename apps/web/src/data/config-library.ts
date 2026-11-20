import type { ConfigLibrary } from "@holdem-knight/core";
import { useMemo } from "react";
import { useChargeRules } from "./charge-rules";
import { useInsuranceRules, useOddsTables } from "./insurance";

/**
 * Every saved config a game's settings can be taken from, or undefined until all are read. One
 * object for as long as nothing in it changes.
 */
export function useConfigLibrary(): ConfigLibrary | undefined {
  const { data: chargeRules } = useChargeRules();
  const { data: insuranceRules } = useInsuranceRules();
  const { data: oddsTables } = useOddsTables();
  return useMemo(
    () =>
      chargeRules && insuranceRules && oddsTables
        ? { chargeRules, insuranceRules, oddsTables }
        : undefined,
    [chargeRules, insuranceRules, oddsTables],
  );
}
